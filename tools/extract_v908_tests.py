#!/usr/bin/env python3
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
for bundle, files in [("tools/v908-sync-tests-a.json",["v907-ascension-lifecycle.test.cjs","v907-storage-regression.test.cjs","v907-quest-regression.test.cjs"]),("tools/v908-sync-tests-b.json",["v907-100-slots-regression.test.cjs","v907-interrupted-settlement.test.cjs","v908-building-progression.test.cjs","run_v908_regression.cjs"])]:
 data=json.loads((R/bundle).read_text(encoding="utf-8"))
 for name in files: (R/"tests"/name).write_text(data[name],encoding="utf-8")
