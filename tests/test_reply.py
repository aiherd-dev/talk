"""Helper lifecycle checks; uses a fake CLI, never a herd or model."""
import json
import os
from pathlib import Path
import pty
import signal
import subprocess
import sys
import tempfile
import time
import unittest

HELPER = Path(__file__).resolve().parents[1] / 'skills/talk-to-my-claude/scripts/reply.py'


class ReplyTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='talk-reply-test-')
        self.addCleanup(self.directory.cleanup)
        self.rig = Path(self.directory.name)
        self.mock = self.rig / 'aih'
        self.mock.write_text('''#!%s
import json, os, pathlib, sys, time
rig = pathlib.Path(os.environ['REPLY_TEST_RIG'])
with (rig/'calls').open('a') as f:
    f.write(json.dumps(sys.argv[1:])+'\\n')
if sys.argv[2] == 'reply':
    path = pathlib.Path(sys.argv[sys.argv.index('--json-file')+1])
    assert path.stat().st_mode & 0o777 == 0o600
    (rig/'published').write_text(json.dumps({'path': str(path), 'value': json.loads(path.read_text())}))
    print(json.dumps({'state': 'completed'}), flush=True)
    sys.exit(int(os.environ.get('REPLY_TEST_FAILURE', '0')))
assert sys.argv[2] == 'next'
assert not pathlib.Path(json.loads((rig/'published').read_text())['path']).exists()
(rig/'waiting').write_text(str(os.getpid()))
while not (rig/'release').exists():
    time.sleep(.02)
print(json.dumps({'question': {'text': 'Follow up 你好'}, 'lease': 'test-lease', 'generation': 2}))
sys.exit(int(os.environ.get('REPLY_TEST_NEXT_FAILURE', '0')))
''' % sys.executable)
        self.mock.chmod(0o700)
        self.value = dict(request_id='1'*32, lease='a'*64, generation=1,
                          text='# שלום / مرحبا\n\nLiteral $(false) and `false`\n你好\n\n'
                               '| שם | value |\n| --- | --- |\n| שלום | `a\\b` |\n\n'
                               '```mermaid\nflowchart RL\n A["שלום"] --> B["مرحبا"]\n```\n')

    def launch(self, next=True, **env):
        p = subprocess.Popen([sys.executable, str(HELPER), '--aih', str(self.mock),
                              '--socket', str(self.rig/'unused.sock'), '--room', '2'*32]
                             + (['--next'] if next else []),
                             env=os.environ | {'REPLY_TEST_RIG': str(self.rig)} | env,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             start_new_session=True)
        self.addCleanup(self.stop, p)
        p.stdin.write(json.dumps(self.value).encode())
        p.stdin.close()
        p.stdin = None
        return p

    def stop(self, p):
        if p.poll() is None:
            os.killpg(p.pid, signal.SIGKILL)
        p.communicate(timeout=5)

    def waiting(self, p):
        end = time.monotonic() + 5
        while not (self.rig/'waiting').exists():
            self.assertIsNone(p.poll())
            self.assertLess(time.monotonic(), end)
            time.sleep(.02)

    def check_publication(self):
        value = json.loads((self.rig/'published').read_text())
        self.assertEqual(value['value'], self.value)
        self.assertFalse(Path(value['path']).exists())

    def test_reply_only_unchanged(self):
        p = self.launch(next=False)
        out, _ = p.communicate(timeout=5)
        self.assertEqual(p.returncode, 0)
        self.assertEqual(json.loads(out)['state'], 'completed')
        self.check_publication()
        self.assertEqual(len((self.rig/'calls').read_text().splitlines()), 1)

    def test_next_waits_in_same_process_then_returns_only_delivery(self):
        p = self.launch()
        self.waiting(p)
        self.check_publication()
        self.assertEqual(int((self.rig/'waiting').read_text()), p.pid)
        self.assertIsNone(p.poll())
        (self.rig/'release').touch()
        out, _ = p.communicate(timeout=5)
        self.assertEqual(p.returncode, 0)
        self.assertEqual(json.loads(out)['question']['text'], 'Follow up 你好')
        calls = [json.loads(s) for s in (self.rig/'calls').read_text().splitlines()]
        self.assertEqual([c[1] for c in calls], ['reply', 'next'])
        self.assertEqual(calls[1], ['talk', 'next', '2'*32, '--socket', str(self.rig/'unused.sock')])

    def test_failed_reply_does_not_start_receive(self):
        p = self.launch(REPLY_TEST_FAILURE='7')
        p.communicate(timeout=5)
        self.assertEqual(p.returncode, 7)
        self.check_publication()
        self.assertEqual(len((self.rig/'calls').read_text().splitlines()), 1)

    def test_failed_receive_does_not_retry_reply(self):
        (self.rig/'release').touch()
        p = self.launch(REPLY_TEST_NEXT_FAILURE='9')
        p.communicate(timeout=5)
        self.assertEqual(p.returncode, 9)
        self.check_publication()
        self.assertEqual(len((self.rig/'calls').read_text().splitlines()), 2)

    def test_owner_cancellation_stops_receiver(self):
        p = self.launch()
        self.waiting(p)
        p.send_signal(signal.SIGINT)
        p.communicate(timeout=5)
        self.assertNotEqual(p.returncode, 0)
        self.check_publication()

    def test_bare_terminal_fails_instead_of_waiting_for_input(self):
        master, slave = pty.openpty()
        try:
            result = subprocess.run([sys.executable, str(HELPER), '--aih', str(self.mock),
                                     '--socket', str(self.rig/'unused.sock'), '--room', '2'*32,
                                     '--next'], stdin=slave, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 2)
            self.assertIn(b'piped or redirected stdin', result.stderr)
            self.assertFalse((self.rig/'calls').exists())
        finally:
            os.close(master)
            os.close(slave)


if __name__ == '__main__':
    unittest.main()
