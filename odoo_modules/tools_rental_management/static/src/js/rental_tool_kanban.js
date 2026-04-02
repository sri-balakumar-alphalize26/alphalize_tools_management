/** @odoo-module */

import { KanbanController } from "@web/views/kanban/kanban_controller";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { onMounted, onPatched } from "@odoo/owl";

class RentalToolKanbanController extends KanbanController {
    static template = "tools_rental_management.RentalToolKanbanView";

    setup() {
        super.setup();
        this.orm = useService("orm");
        this.allSelected = false;

        const injectCheckboxes = () => {
            const cards = document.querySelectorAll(".o_kanban_record:not(.rental-cb-done)");
            cards.forEach((card) => {
                card.classList.add("rental-cb-done");
                if (!card.querySelector(".o_rental_tool_card, .o_kanban_record_body, .oe_kanban_card") && !card.textContent.trim()) return;
                if (card.offsetHeight < 50) return;

                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.className = "rental-select-cb";
                cb.style.cssText = "position:absolute;top:8px;left:8px;width:20px;height:20px;z-index:10;cursor:pointer;accent-color:#dc3545;";
                card.style.position = "relative";

                cb.addEventListener("change", (e) => e.stopPropagation());
                cb.addEventListener("click", (e) => e.stopPropagation());
                card.prepend(cb);
            });
        };

        onMounted(injectCheckboxes);
        onPatched(injectCheckboxes);
    }

    onGenerateSerials() {
        this.actionService.doAction(
            "tools_rental_management.action_rental_generate_serials",
            { onClose: () => this.model.load() }
        );
    }

    _getAllRecordIds() {
        const records = this.model.root.records || [];
        return records.map((r) => r.resId).filter(Boolean);
    }

    async onDeleteSelected() {
        const allIds = this._getAllRecordIds();
        const cbs = document.querySelectorAll(".rental-select-cb");
        const ids = [];
        cbs.forEach((cb, idx) => {
            if (cb.checked && allIds[idx]) ids.push(allIds[idx]);
        });
        if (!ids.length) {
            alert("Please select tools first using the checkboxes.");
            return;
        }
        if (!confirm(`Delete ${ids.length} tool(s)? This cannot be undone.`)) return;
        await this.orm.unlink("rental.tool", ids);
        this.allSelected = false;
        await this.model.load();
    }

    onSelectAll() {
        const shouldSelect = !this.allSelected;
        const cbs = document.querySelectorAll(".rental-select-cb");
        cbs.forEach((cb) => {
            const card = cb.parentElement;
            cb.checked = shouldSelect;
            card.style.outline = shouldSelect ? "3px solid #dc3545" : "";
            card.style.outlineOffset = shouldSelect ? "-3px" : "";
        });
        this.allSelected = shouldSelect;
    }
}

export const rentalToolKanbanView = {
    ...kanbanView,
    Controller: RentalToolKanbanController,
};

registry.category("views").add("rental_tool_kanban", rentalToolKanbanView);
