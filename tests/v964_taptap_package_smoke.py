#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compile V90.64 TapTap candidate against the archived V90.10 adapter as a SMOKE FIXTURE.
This is NOT the actual production V90.7 adapter and NOT an approved release build.
The real v907 adapter and two official standard leaderboard IDs remain separate gates.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
ARCHIVED=ROOT/"taptap-build"/"shanhe-v910-taptap"/"index.html"
TARGET=ROOT/"tools"/"build_taptap_v964_from_v9064.py"
def check(value,msg):
    if not value: raise AssertionError(msg)
def make_adapter(html):
    start=html.index("<body>\n<script>\n")+len("<body>\n<script>\n")
    end=html.index("</script>",start)
    code=html[start:end]
    check("globalThis.QTap" in code,"fixture adapter not found")
    check("ad-life-confirm" in code,"fixture lacks ad interception")
    return code
def once(base,ids):
    work=base/"source"
    for path in ["releases/山野修仙记_V90.64_难度分级版.html",
                 "tools/build_taptap_v964_from_v9064.py",
                 "tools/templates/taptap-selftest.html",
                 "tools/templates/taptap-readme.md",
                 "platform/taptap-difficulty-ranks-v964.js"]:
        dest=work/path
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/path,dest)
    adapter=base/"archived-fixture-adapter.js"
    adapter.write_text(make_adapter(ARCHIVED.read_text(encoding="utf-8")),encoding="utf-8")
    env=os.environ.copy()
    env["TAPTAP_ADAPTER_PATH"]=str(adapter)
    if ids:
        env["TAPTAP_STANDARD_POWER_ID"]="TEST-STD-POWER"
        env["TAPTAP_STANDARD_SPEEDRUN_ID"]="TEST-STD-SPEED"
    else:
        env.pop("TAPTAP_STANDARD_POWER_ID",None)
        env.pop("TAPTAP_STANDARD_SPEEDRUN_ID",None)
    p=subprocess.run([sys.executable,str(work/"tools"/TARGET.name)],cwd=work,
                     env=env,capture_output=True,text=True,encoding="utf-8",errors="replace")
    check(p.returncode==0,"fixture build failed:\n"+p.stdout[-3500:]+"\n"+p.stderr[-1200:])
    out=work/"taptap-build"/"shanhe-v964-taptap"
    manifest=json.loads((out/"build-manifest.json").read_text(encoding="utf-8"))
    result=(out/"index.html").read_text(encoding="utf-8")
    check(manifest["onlineStandardBoardsConfigured"]==bool(ids),"ranking configuration gate")
    check(manifest["version"]=="V90.64","wrong platform version")
    check(manifest["difficulty"]=={"easy":0.5,"standard":0.8,"challenge":1.0},"scale config")
    check("__SHANYE_STANDARD_BOARD_IDS" in result,"guard IDs not injected")
    check("rankDifficulty" in result,"guard implementation missing")
    check("ad-life-rescue" in result,"rescue ad not intercepted")
    check(manifest["outputSha256"]==hashlib.sha256((out/"index.html").read_bytes()).hexdigest().upper(),"content hash not accurate")
    # Syntactic JS compilation catches malformed <script> separators or '\\n' literals.
    node= r"""const fs=require('fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[1],'utf8');
const scripts=[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
for(let i=0;i<scripts.length;i++)try{new vm.Script(scripts[i])}
catch(e){throw Error('script '+i+' syntax: '+e.message);}
console.log('V90.64 platform JS syntax '+scripts.length+' blocks PASS');"""
    check(subprocess.run(["node","-e",node,str(out/"index.html")],capture_output=True,text=True).returncode==0,
          "mock platform HTML JS syntax broken")
    return manifest["outputSha256"]
def main():
    check(ARCHIVED.exists(),"missing archived smoke adapter; not production adapter")
    with TemporaryDirectory(prefix="shanye964-") as p:
        a=once(Path(p)/"no-ids",False)
        b=once(Path(p)/"configured-ids",True)
        check(a!=b,"separate ID profiles unexpectedly identical")
        print("V90.64 TapTap PACKAGE SMOKE PASS 2/2; fixture adapter only, NOT production verified")
        print("STD LEADERBOARD PUBLISH GATE = BLOCKED until official IDs and actual V90.7 adapter verified")
if __name__=="__main__":
    main()
