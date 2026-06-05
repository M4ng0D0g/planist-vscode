// .agents/skills/traffic-light-guardrail/examples/syntax.ts

class OrderController {

    // @state: green
    // 💡 綠燈範例：此函式已完全穩定，不論在任何 Debug 模式下，Agent 絕對禁止碰觸大括號內的代碼。
    public getOrderDetails(orderId: string): any {
        if (!orderId) return null;
        return { id: orderId, status: "PENDING" };
    }

    // @state: red
    // 💡 紅燈範例：此功能原本是綠燈，但因為需要擴充金流邏輯，已解鎖開放修改。
    public checkout(cartId: string): boolean {
        // Agent 可以在此處新增或修改代碼
        console.log("Processing checkout for cart:", cartId);
        // -> PaymentGateway.process()
        return true;
    }

    // @state: yellow
    // 💡 黃燈範例：這是全新開發或正在大幅重構中的方法，Agent 擁有最高讀寫權限，直到測試全數通過為止。
    public applyDiscountCode(code: string): number {
        if (code === "FREE_SHIPPING") {
            return 0;
        }
        return 10;
    }
}