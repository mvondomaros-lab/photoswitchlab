"""RDKit source for azobenzene.svg, using the web app's drawing style."""

from structures import TRANS, export_structure
from style import run


def render(output_dir=None, formats=("svg",)):
    export_structure("azobenzene", TRANS, output_dir, formats)


if __name__ == "__main__":
    run(render, __doc__)
