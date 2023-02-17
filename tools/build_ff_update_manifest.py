#!/usr/bin/env python3

import json
import sys

if len(sys.argv) != 4:
    print(f"Usage: {sys.argv[0]} NEW_VERSION NEW_VERSION_URL NEW_VERSION_HASH")
    sys.exit(1)

NEW_VERSION = sys.argv[1]
NEW_VERSION_URL = sys.argv[2]
NEW_VERSION_HASH = sys.argv[3]

with open('./.updates/ff/updates.json', 'r') as f:
    addons = json.load(f)


update_obj = {
    "version": NEW_VERSION.replace('v', ''),
    "update_link": NEW_VERSION_URL,
    "update_hash": NEW_VERSION_HASH
}


addons['addons']['blocktube@git']['updates'].insert(0, update_obj)

with open('./.updates/ff/updates.json', 'w') as f:
    json.dump(addons, f, indent=2)
