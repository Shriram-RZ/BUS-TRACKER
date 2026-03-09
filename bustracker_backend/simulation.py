"""
Legacy entrypoint for bus simulation.

The canonical implementation now lives in ``simulation/bus_simulator.py``.
We re-export the public ``start_simulation`` function so existing imports
like ``from simulation import start_simulation`` continue to work, and keep
the CLI helper available.
"""

import asyncio
import logging

from .simulation.bus_simulator import start_simulation  # type: ignore[attr-defined]

logger = logging.getLogger("simulation")


async def _cli_main() -> None:
    """Helper used when running ``python simulation.py`` directly."""
    await start_simulation()
    # run forever (until the user presses Ctrl+C)
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )
    try:
        asyncio.run(_cli_main())
    except KeyboardInterrupt:
        logger.info("✋ Simulation interrupted by user, exiting.")

