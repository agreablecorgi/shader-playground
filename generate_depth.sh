#!/bin/bash
# Linux/Mac version of depth generation

if [ $# -eq 0 ]; then
    echo "Usage:"
    echo "  Single image:  ./generate_depth.sh image.jpg"
    echo "  Batch folder:  ./generate_depth.sh -b ./images"
    exit 1
fi

python3 scripts/depth_pro_generate.py "$@"
