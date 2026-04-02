/** @odoo-module */

import { ListController } from "@web/views/list/list_controller";
import { listView } from "@web/views/list/list_view";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class RentalProductListController extends ListController {
    static template = "tools_rental_management.RentalProductListView";

    setup() {
        super.setup();
        this.orm = useService("orm");
    }

    onGenerateSerials() {
        this.actionService.doAction(
            "tools_rental_management.action_rental_generate_serials",
            {
                onClose: () => {
                    this.model.load();
                },
            }
        );
    }

    async onDeleteSelected() {
        const selectedIds = this.model.root.selection.map((r) => r.resId);
        if (!selectedIds.length) {
            return;
        }
        const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} product(s)? This cannot be undone.`);
        if (confirmed) {
            await this.orm.unlink("product.product", selectedIds);
            await this.model.load();
        }
    }
}

export const rentalProductListView = {
    ...listView,
    Controller: RentalProductListController,
};

registry.category("views").add("rental_product_list", rentalProductListView);
