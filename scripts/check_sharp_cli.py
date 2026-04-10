"""Print the SHARP CLI path if the companion can discover it."""

from __future__ import annotations

from shader_companion import find_sharp_cli


def main() -> int:
    sharp_cli = find_sharp_cli()
    if not sharp_cli:
        return 1

    print(sharp_cli)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
