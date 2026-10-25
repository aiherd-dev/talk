import json, os, pathlib, subprocess, tempfile
source=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='aih-talk-skill-install-') as directory:
    rig=pathlib.Path(directory); project=rig/'project';project.mkdir();home=rig/'home';home.mkdir()
    agent_overrides={'CODEX_HOME','CLAUDE_CONFIG_DIR','VIBE_HOME','HERMES_HOME','AUTOHAND_HOME','GROK_HOME','SARVAM_HOME','APPDATA','FLATPAK_XDG_CONFIG_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_STATE_HOME','XDG_CACHE_HOME'}
    env={k:v for k,v in os.environ.items() if k not in agent_overrides}|{'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'DISABLE_TELEMETRY':'1','npm_config_cache':str(rig/'npm-cache')}
    resources={
        'talk-to-my-claude': ['references/setup.md','references/controller-runtime.md','agents/openai.yaml'],
        'join-talk-room': ['scripts/guest.mts','agents/openai.yaml'],
    }
    global_agents=['claude-code','codex','opencode','cursor','gemini-cli','goose','pi']
    expected_agents={'Claude Code','Codex','OpenCode','Cursor','Gemini CLI','Goose','Pi'}
    for skill,global_scope in [(s,g) for s in resources for g in (False,True)]:
        agents=global_agents if global_scope else ['*']
        argv=['npx','--yes','skills','add',os.environ.get('AIH_TALK_SKILL_SOURCE',str(source)),'--skill',skill,'--agent',*agents,'--copy','--yes','--json']
        if global_scope:argv.append('--global')
        result=subprocess.run(argv,cwd=project,env=env,capture_output=True,text=True,timeout=120)
        assert result.returncode==0,result.stderr
        installed=json.loads(result.stdout)
        assert len(installed)==1 and installed[0]['status']=='installed' and installed[0]['name']==skill, installed
        assert expected_agents <= set(installed[0]['agents']), installed[0]['agents']
        assert installed[0]['mode']=='copy'
        roots=list((home if global_scope else project).rglob(f'{skill}/SKILL.md'))
        assert roots, result.stdout
        for root in roots:
            folder=root.parent
            original=(source/'skills'/skill/'SKILL.md').read_text()
            if not global_scope and root==project/'agent/skills'/skill/'SKILL.md':
                # The Skills CLI deliberately normalizes Eve's supported frontmatter.
                assert root.read_text().split('---',2)[2].lstrip('\r\n')==original.split('---',2)[2].lstrip('\r\n')
            else:
                assert root.read_text()==original, str(root.relative_to(rig))
            for resource in resources[skill]:
                assert (folder/resource).read_bytes()==(source/'skills'/skill/resource).read_bytes()
            assert not any(p.is_symlink() for p in folder.rglob('*'))
        print(f"{skill}: copied and verified resources for {len(installed[0]['agents'])} {'global' if global_scope else 'project'} agent targets.",flush=True)
print('Both skills verified for all project agents and seven global agent targets.')
