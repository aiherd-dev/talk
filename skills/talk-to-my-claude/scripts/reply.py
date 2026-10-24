#!/usr/bin/env python3
"""Publish structured stdin; optionally replace this process with the next receive."""
import argparse
import csv
import re
import json
import os
import subprocess
import sys
import tempfile


def restrict_windows_acl(path):
    # Set the DACL while the file is still empty, before writing a lease or reply.
    result = subprocess.run(['whoami.exe', '/user', '/fo', 'csv', '/nh'],
                            capture_output=True, text=True, check=True)
    rows = list(csv.reader(result.stdout.strip().splitlines()))
    if len(rows) != 1 or len(rows[0]) != 2 or not re.fullmatch(r'S-\d+(?:-\d+)+', rows[0][1]):
        raise RuntimeError('Could not resolve the current Windows account SID')
    subprocess.run(['icacls.exe', path, '/inheritance:r', '/grant:r',
                    '*' + rows[0][1] + ':F', '*S-1-5-18:F', '*S-1-5-32-544:F'],
                   stdout=subprocess.DEVNULL, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--aih', default='aih')
    parser.add_argument('--socket', required=True)
    parser.add_argument('--room', required=True)
    parser.add_argument('--next', action='store_true',
                        help='after a successful reply, wait for the next delivery in this process')
    args = parser.parse_args()
    if sys.stdin.isatty():
        parser.error('supply complete reply JSON through piped or redirected stdin, not an interactive terminal')
    data = sys.stdin.buffer.read(512 * 1024 + 1)
    if len(data) > 512 * 1024:
        parser.error('reply JSON exceeds the IPC limit')
    value = json.loads(data)
    if not isinstance(value, dict) or set(value) != {'request_id', 'lease', 'generation', 'text'}:
        parser.error('expected request_id, lease, generation and text')
    fd, path = tempfile.mkstemp(prefix='aih-talk-reply-', suffix='.json')
    try:
        with os.fdopen(fd, 'wb') as output:
            if os.name == 'nt':
                restrict_windows_acl(path)
            output.write(data)
        result = subprocess.run([args.aih, 'talk', 'reply', args.room, '--json-file', path,
                                 '--socket', args.socket], check=False,
                                stdout=subprocess.PIPE if args.next else None)
    finally:
        os.unlink(path)
    if not args.next:
        return result.returncode
    if result.returncode:
        sys.stdout.buffer.write(result.stdout)
        return result.returncode
    # Do not expose the acknowledgement as if it were another delivery. Remove
    # the private file before waiting, and retain the PTY/process identity so
    # owner cancellation reaches the receiver directly. Never retry the reply.
    os.execvp(args.aih, [args.aih, 'talk', 'next', args.room, '--socket', args.socket])


if __name__ == '__main__':
    sys.exit(main())
