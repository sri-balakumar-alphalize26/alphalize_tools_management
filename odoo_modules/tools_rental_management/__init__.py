from . import models
from . import wizard


def _post_init_sync_categories(env):
    """No longer syncing product.category to rental.tool.category."""
    pass
