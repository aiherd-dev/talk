import json, os, pathlib, subprocess, tempfile
source=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='aih-talk-skill-install-') as directory:
    rig=pathlib.Path(directory); project=rig/'project';project.mkdir();home=rig/'home';home.mkdir()
    env=os.environ|{'HOME':str(home),'DISABLE_TELEMETRY':'1','npm_config_cache':str(rig/'npm-cache')}
    resources={
        'talk-to-my-claude': ['references/setup.md','scripts/reply.py','references/controller-runtime.md','agents/openai.yaml'],
        'join-talk-room': ['scripts/guest.mts','agents/openai.yaml'],
    }
    for skill,agent,global_scope in [(s,a,g) for s in resources for a in ('claude-code','codex') for g in (False,True)]:
        argv=['npx','--yes','skills','add',os.environ.get('AIH_TALK_SKILL_SOURCE',str(source)),'--skill',skill,'--agent',agent,'--copy','--yes']
        if global_scope:argv.append('--global')
        result=subprocess.run(argv,cwd=project,env=env,capture_output=True,text=True,timeout=120)
        assert result.returncode==0,result.stderr
        roots=list((home if global_scope else project).rglob(f'{skill}/SKILL.md'))
        assert roots, result.stdout
        for root in roots:
            folder=root.parent
            assert root.read_text()==(source/'skills'/skill/'SKILL.md').read_text()
            for resource in resources[skill]:
                assert (folder/resource).read_bytes()==(source/'skills'/skill/resource).read_bytes()
            assert not any(p.is_symlink() for p in folder.rglob('*'))
    # Exercise the real helper's subprocess argument/data boundary and private-file lifecycle.
    executable=rig/'mock-aih'
    executable.write_text('#!/usr/bin/python3\nimport sys,json,pathlib\np=pathlib.Path(sys.argv[sys.argv.index("--json-file")+1]);assert p.stat().st_mode & 0o777 == 0o600\nprint(json.dumps({"payload":json.loads(p.read_text()),"path":str(p)}))\n')
    executable.chmod(0o700)
    value={'request_id':'1'*32,'lease':'a'*64,'generation':1,'text':'Literal $(touch /tmp/aih-talk-must-not-run) and `false`\n你好'}
    result=subprocess.run(['python3',str(source/'skills/talk-to-my-claude/scripts/reply.py'),'--aih',str(executable),'--socket',str(rig/'unused.sock'),'--room','2'*32],input=json.dumps(value),text=True,capture_output=True,check=True)
    published=json.loads(result.stdout);assert published['payload']==value;assert not pathlib.Path(published['path']).exists();assert not pathlib.Path('/tmp/aih-talk-must-not-run').exists()
print('Both skills copy their resources for project/global Claude Code and Codex installs; private reply file cleaned up.')
