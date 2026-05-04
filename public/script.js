// const API_BASE = (() => {
//   if (
//     window.location.hostname === "localhost" ||
//     window.location.hostname === "127.0.0.1"
//   ) {
//     return "https://localhost:8080/api" && "http://localhost:3000/api";
//   }
//   return window.location.origin + "/api";
// })();


const API_BASE = (() => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3000/api";
  }
  return window.location.origin + "/api";
})();
// async function apiFetch(url, options = {}) {
//   const res = await fetch(url, options);
//   if (res.status === 401) {
//     window.location.href = "/login";
//     return null;
//   }
//   return res;
// }
async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = "/login";
    return null;
  }
  if (res.status === 403) {
    const error = await res.json();
    alert(error.error || "مدت اعتبار سیستم به پایان رسیده است.");
    // جلوگیری از ادامه عملیات
    return null;
  }
  // در صورت خطای 500 نیز هشدار دهید
  if (res.status >= 500) {
    alert("خطای سرور. لطفاً با مدیر تماس بگیرید.");
    return null;
  }
  return res;
}
// ================== تابع تغییر رمز عبور (عمومی) ==================
function showPasswordChangeModal(userId, username, isSelf = true) {
  // ایجاد مودال
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal-card";

  let html = `
    <h3>تغییر رمز عبور کاربر: ${escapeHtml(username)}</h3>
    <form id="changePasswordForm">
  `;
  if (isSelf) {
    html += `
      <label>رمز عبور قدیمی</label>
      <input type="password" id="oldPassword" placeholder="رمز عبور قدیمی" required>
    `;
  }
  html += `
      <label>رمز عبور جدید</label>
      <input type="password" id="newPassword" placeholder="رمز عبور جدید" required minlength="4">
      <label>تکرار رمز عبور جدید</label>
      <input type="password" id="confirmPassword" placeholder="تکرار رمز عبور جدید" required>
      <div class="form-actions">
        <button type="submit" class="btn">تغییر رمز</button>
        <button type="button" id="cancelPasswordForm" class="btn ghost">انصراف</button>
      </div>
    </form>
  `;
  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector("#cancelPasswordForm").onclick = closeModal;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const form = modal.querySelector("#changePasswordForm");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const newPassword = modal.querySelector("#newPassword").value;
    const confirmPassword = modal.querySelector("#confirmPassword").value;

    if (newPassword !== confirmPassword) {
      alert("رمز عبور جدید با تکرار آن مطابقت ندارد");
      return;
    }
    if (newPassword.length < 4) {
      alert("رمز عبور باید حداقل 4 کاراکتر باشد");
      return;
    }

    const body = { password: newPassword };
    if (isSelf) {
      const oldPassword = modal.querySelector("#oldPassword").value;
      if (!oldPassword) {
        alert("لطفاً رمز عبور قدیمی را وارد کنید");
        return;
      }
      body.oldPassword = oldPassword;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        alert("رمز عبور با موفقیت تغییر کرد");
        closeModal();
      } else {
        alert("خطا: " + (data.error || "تغییر رمز ناموفق بود"));
      }
    } catch (err) {
      console.error(err);
      alert("خطا در ارتباط با سرور");
    }
  };
}

function uid(prefix = "id") {
  // استفاده از timestamp میلی‌ثانیه + یک بخش تصادفی کوتاه
  const time = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${time}_${random}`;
}
function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        // محاسبه ابعاد جدید با حفظ نسبت
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        // ایجاد canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        // تبدیل به JPEG با کیفیت مشخص
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
// Global escapeHtml function (used everywhere)
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
let currentActiveTab = "products";
let currentUserRole = null;
let currentUsername = null;
let currentUserId = null;
const DB = {
  data: {
    products: [],
    suppliers: [],
    locations: [],
    transactions: [],
    customers: [],
    invoices: [],
    expenses: [],
    staff: [],
    salaryPayments: [],
  },

  async load() {
    // ⚠️ مرحله 0: بررسی وضعیت لایسنس قبل از هر بارگذاری
    try {
      const licenseRes = await fetch("/api/license-status");
      if (licenseRes.ok) {
        const license = await licenseRes.json();
        if (!license.enabled || license.expired) {
          const msg = license.expired
            ? "⚠️ مدت اعتبار سیستم به پایان رسیده است. لطفاً با مدیر تماس بگیرید."
            : "⚠️ سیستم غیرفعال است. با مدیر تماس بگیرید.";
          alert(msg);
          // صفحه را قفل می‌کنیم یا به لاگین redirect می‌کنیم
          window.location.href = "/login";
          return; // توقف کامل بارگذاری
        }
      } else {
        console.warn("Unable to check license status");
      }
    } catch (err) {
      console.error("License check error:", err);
    }

    // 1. بررسی احراز هویت و دریافت نقش
    const authRes = await apiFetch("/api/check");
    if (!authRes) return;
    const authData = await authRes.json();
    currentUserRole = authData.role;
    currentUsername = authData.username;
    currentUserId = authData.userId;

    // 2. درخواست‌های عمومی (همه نقش‌ها)
    const productsRes = await apiFetch(API_BASE + "/products");
    if (!productsRes) return;
    const products = await productsRes.json();

    const suppliersRes = await apiFetch(API_BASE + "/suppliers");
    if (!suppliersRes) return;
    const suppliers = await suppliersRes.json();

    const locationsRes = await apiFetch(API_BASE + "/locations");
    if (!locationsRes) return;
    const locations = await locationsRes.json();

    // 3. مشتریان (فقط ادمین و مدیر مالی)
    let customers = [];
    if (currentUserRole === "admin" || currentUserRole === "finance") {
      const customersRes = await apiFetch(API_BASE + "/customers");
      if (customersRes) customers = await customersRes.json();
    }

    // 4. داده‌های مالی (تراکنش، فاکتور، هزینه) – فقط ادمین و مدیر مالی
    let transactions = [];
    let invoices = [];
    let expenses = [];
    if (currentUserRole === "admin" || currentUserRole === "finance") {
      const transactionsRes = await apiFetch(
        API_BASE + "/transactions?limit=1000",
      );
      if (transactionsRes) transactions = await transactionsRes.json();

      const invoicesRes = await apiFetch(API_BASE + "/invoices");
      if (invoicesRes) invoices = await invoicesRes.json();

      const expensesRes = await apiFetch(API_BASE + "/expenses");
      const serialsRes = await apiFetch(API_BASE + "/export");
      let serials = [];
      if (serialsRes) {
        const fullExport = await serialsRes.json();
        serials = fullExport.serials || [];
      }
      this.data.serials = serials.map((s) => ({
        id: s.id,
        product_id: s.product_id,
        transaction_id: s.transaction_id,
        serial: s.serial,
        date: s.date,
        status: s.status,
        purchase_price: s.purchase_price ? Number(s.purchase_price) : null,
        sale_price: s.sale_price ? Number(s.sale_price) : null,
      }));
      if (expensesRes) expenses = await expensesRes.json();
    }

    // 5. داده‌های پرسونل و معاشات (ادمین، مدیر اداری و مدیر مالی)
    let staff = [];
    let salaryPayments = [];
    if (
      currentUserRole === "admin" ||
      currentUserRole === "admin_staff" ||
      currentUserRole === "finance"
    ) {
      const staffRes = await apiFetch(API_BASE + "/staff");
      if (staffRes) staff = await staffRes.json();

      const salaryRes = await apiFetch(
        API_BASE + "/salary-payments?limit=1000",
      );
      if (salaryRes) salaryPayments = await salaryRes.json();
    }

    // 6. پردازش و ذخیره در this.data
    this.data.products = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      locationId: p.location_id,
      minStock: p.min_stock,
      defaultPurchasePrice:
        p.default_purchase_price != null
          ? Number(p.default_purchase_price)
          : null,
      defaultSalePrice:
        p.default_sale_price != null ? Number(p.default_sale_price) : null,
      image: p.image || null,
    }));

    this.data.suppliers = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      total_debt: Number(s.total_debt) || 0,
      total_discount: Number(s.total_discount) || 0,
    }));

    this.data.locations = locations.map((l) => ({
      id: l.id,
      name: l.name,
    }));

    this.data.customers = customers.map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
    }));

    this.data.transactions = transactions.map((t) => {
      const qty = Number(t.qty || 0);
      const unitPrice = Number(t.unit_price ?? t.unitPrice ?? 0);
      const amount = Number(t.amount ?? qty * unitPrice ?? 0);
      return {
        id: t.id,
        productId: t.product_id ?? t.productId ?? null,
        type: t.type,
        qty,
        date: t.date,
        note: t.note || "",
        supplierId: t.supplier_id ?? t.supplierId ?? null,
        unitPrice: isNaN(unitPrice) ? null : unitPrice,
        amount: Number(amount.toFixed(2)),
        moneyIn: Number(
          (t.money_in ?? t.moneyIn ?? (t.type === "in" ? amount : 0)) || 0,
        ).toFixed(2),
        moneyOut: Number(
          (t.money_out ?? t.moneyOut ?? (t.type === "out" ? amount : 0)) || 0,
        ).toFixed(2),
        customerId: t.customer_id ?? t.customerId ?? null,
        customerName: t.customer_name ?? t.customerName ?? null,
        serials: t.serials || [],
        hasDebt: t.hasDebt || false,
        debtAmount: t.debtAmount || 0,
        hasDiscount: t.hasDiscount || false,
        discountAmount: t.discountAmount || 0,
        profit: t.profit || 0,
        description: t.description || "",
        paid_to_supplier: t.paid_to_supplier || 0, // <-- اضافه شد
        supplier_remaining_action: t.supplier_remaining_action || "discount", // <-- اضافه شد
      };
    });

    this.data.invoices = invoices.map((i) => ({
      id: i.id,
      customer_id: i.customer_id,
      customer_name: i.customer_name,
      date: i.date,
      total: i.total,
      note: i.note,
      paid_amount: i.paid_amount || 0,
      remaining_action: i.remaining_action || "discount",
    }));

    this.data.expenses = expenses.map((e) => ({
      id: e.id,
      date: e.date,
      amount: e.amount,
      category: e.category || "",
      description: e.description || "",
    }));

    this.data.staff = staff;
    this.data.salaryPayments = salaryPayments;

    return this.data;
  },
  // Products
  async createProduct(p) {
    const body = {
      id: p.id || uid("prod"),
      sku: p.sku,
      name: p.name,
      category: p.category,
      locationId: p.locationId,
      minStock: p.minStock || 0,
      default_purchase_price: p.defaultPurchasePrice ?? null,
      default_sale_price: p.defaultSalePrice ?? null,
      image: p.image || null,
    };
    const res = await fetch(API_BASE + "/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`خطا در ایجاد کالا (${res.status}): ${errorText}`);
    }

    const prod = await res.json();
    this.data.products.push({
      id: prod.id,
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      locationId: prod.location_id,
      minStock: prod.min_stock,
      defaultPurchasePrice:
        prod.default_purchase_price != null
          ? Number(prod.default_purchase_price)
          : null,
      defaultSalePrice:
        prod.default_sale_price != null
          ? Number(prod.default_sale_price)
          : null,
    });

    if (typeof checkAndNotifyLowStock === "function") {
      try {
        checkAndNotifyLowStock();
      } catch (e) {
        console.error("خطا در بررسی موجودی:", e);
      }
    }
    return prod;
  },

  async updateProduct(id, p) {
    await fetch(API_BASE + "/products/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: p.sku,
        name: p.name,
        category: p.category,
        locationId: p.locationId,
        minStock: p.minStock,
        default_purchase_price: p.defaultPurchasePrice ?? null,
        default_sale_price: p.defaultSalePrice ?? null,
        image: p.image || null,
      }),
    });
    const idx = this.data.products.findIndex((x) => x.id === id);
    if (idx >= 0)
      this.data.products[idx] = { ...this.data.products[idx], ...p };
  },

  async deleteProduct(id) {
    const res = await fetch(API_BASE + "/products/" + id, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "خطا در حذف کالا از سرور");
    }
    this.data.products = this.data.products.filter((x) => x.id !== id);
  },

  // Suppliers
  async createSupplier(s) {
    const body = {
      id: s.id || uid("sup"),
      name: s.name,
      contact: s.contact,
    };
    const res = await fetch(API_BASE + "/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r = await res.json();
    this.data.suppliers.push({
      id: r.id,
      name: r.name,
      contact: r.contact,
    });
    return r;
  },
  async updateSupplier(id, s) {
    await fetch(API_BASE + "/suppliers/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const idx = this.data.suppliers.findIndex((x) => x.id === id);
    if (idx >= 0)
      this.data.suppliers[idx] = { ...this.data.suppliers[idx], ...s };
  },
  async deleteSupplier(id) {
    await fetch(API_BASE + "/suppliers/" + id, { method: "DELETE" });
    this.data.suppliers = this.data.suppliers.filter((x) => x.id !== id);
  },

  // Locations
  async createLocation(l) {
    const body = { id: l.id || uid("loc"), name: l.name };
    const res = await fetch(API_BASE + "/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r = await res.json();
    this.data.locations.push({ id: r.id, name: r.name });
    return r;
  },
  async updateLocation(id, l) {
    await fetch(API_BASE + "/locations/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(l),
    });
    const idx = this.data.locations.findIndex((x) => x.id === id);
    if (idx >= 0)
      this.data.locations[idx] = { ...this.data.locations[idx], ...l };
  },
  async deleteLocation(id) {
    await fetch(API_BASE + "/locations/" + id, { method: "DELETE" });
    this.data.locations = this.data.locations.filter((x) => x.id !== id);
  },

  // Transactions
  async createTransaction(tx) {
    const body = {
      id: tx.id,
      productId: tx.productId,
      type: tx.type,
      qty: tx.qty,
      supplierId: tx.supplierId || null,
      note: tx.note || "",
      date: tx.date || new Date().toISOString(),
      unit_price: tx.unit_price || null,
      serialNumbers: Array.isArray(tx.serialNumbers) ? tx.serialNumbers : [],
      default_sale_price: tx.default_sale_price || null,
      paidToSupplier: tx.paidToSupplier || 0,
      supplierRemainingAction: tx.supplierRemainingAction || "discount",
      description: tx.description || "",
      attachments: tx.attachments || [], // <-- اضافه شد
    };

    const res = await fetch(API_BASE + "/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`خطا در ایجاد تراکنش: ${errText}`);
    }
    const r = await res.json();

    // ذخیره کامل اطلاعات برگشتی از سرور در حافظه محلی
    this.data.transactions.push({
      id: r.id,
      productId: r.product_id,
      type: r.type,
      qty: r.qty,
      date: r.date,
      note: r.note || "",
      supplierId: r.supplier_id,
      unit_price: r.unit_price,
      amount: Number(r.amount || r.qty * (r.unit_price || 0)).toFixed(2),
      paid_to_supplier: r.paid_to_supplier || 0,
      supplier_remaining_action: r.supplier_remaining_action || "discount",
      description: r.description || "",
      // سایر فیلدهایی که ممکن است نیاز باشد
    });

    if (typeof checkAndNotifyLowStock === "function") {
      try {
        checkAndNotifyLowStock();
      } catch (e) {
        console.error(e);
      }
    }
    return r;
  },

  // export / import
  async exportJson() {
    return fetch(API_BASE + "/export").then((r) => r.json());
  },
  async importJson(rawObj) {
    await fetch(API_BASE + "/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawObj),
    });
    return this.load();
  },

  // Customers
  async createCustomer(c) {
    const body = {
      id: c.id || uid("cus"),
      name: c.name,
      contact: c.contact || "",
    };
    const res = await fetch(API_BASE + "/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r = await res.json();
    this.data.customers.push({
      id: r.id,
      name: r.name,
      contact: r.contact,
    });
    return r;
  },

  // Invoices
  async createInvoice(inv) {
    const res = await fetch(API_BASE + "/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: inv.id,
        customerId: inv.customerId,
        date: inv.date || new Date().toISOString(),
        note: inv.note || "",
        items: inv.items,
        paidAmount: inv.paidAmount || 0,
        remainingAction: inv.remainingAction || "discount",
      }),
    });
    if (!res.ok) {
      let errorMsg = "failed create invoice";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore
      }
      throw new Error(errorMsg);
    }
    return res.json();
  },
  async deleteInvoice(id) {
    const res = await fetch(API_BASE + "/invoices/" + id, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "خطا در حذف فاکتور");
    }
    return res.json();
  },
  async getInvoice(id) {
    const res = await fetch(API_BASE + "/invoices/" + id);
    if (!res.ok) return null;
    return res.json();
  },
  async createExpense(exp) {
    const body = {
      id: exp.id || uid("exp"),
      date: exp.date || new Date().toISOString(),
      amount: exp.amount,
      category: exp.category || "",
      description: exp.description || "",
    };
    const res = await fetch(API_BASE + "/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r = await res.json();
    this.data.expenses.push({
      id: r.id,
      date: r.date,
      amount: r.amount,
      category: r.category,
      description: r.description,
    });
    return r;
  },

  async updateExpense(id, exp) {
    await fetch(API_BASE + "/expenses/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exp),
    });
    const idx = this.data.expenses.findIndex((x) => x.id === id);
    if (idx >= 0)
      this.data.expenses[idx] = { ...this.data.expenses[idx], ...exp };
  },

  async deleteExpense(id) {
    await fetch(API_BASE + "/expenses/" + id, { method: "DELETE" });
    this.data.expenses = this.data.expenses.filter((x) => x.id !== id);
  },
  // reset via import empty arrays
  async reset() {
    await this.importJson({
      products: [],
      suppliers: [],
      locations: [],
      transactions: [],
    });
  },
};

/*********************** UI و منوها
    Tabs: کالاها، تامین‌کنندگان، موقعیت‌ها، تراکنش‌ها، گزارشات
  ***********************/
const tabs = [
  {
    id: "products",
    title: "اجناس",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
  }, // آیکن انبار
  {
    id: "suppliers",
    title: "تامین‌کنندگان",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  }, // آیکن افراد
  {
    id: "locations",
    title: "موقعیت‌های انبار",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
  }, // آیکن موقعیت
  {
    id: "transactions",
    title: "معاملات",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5M17 5l-3-3 3 3zM7 19h7.5M7 19l3 3-3-3z"></path></svg>',
  }, // آیکن تراکنش
  {
    id: "expenses",
    title: "مصارف",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5M17 5l-3-3 3 3zM7 19h7.5M7 19l3 3-3-3z"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
  }, // آیکن هزینه
  {
    id: "salaries",
    title: "معاشات",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>',
  },
  {
    id: "reports",
    title: "گزارش",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2"/><circle cx="12" cy="16" r="5"/><path d="M12 11v5"/></svg>',
  }, // آیکن گزارش
  {
    id: "invoices",
    title: "بل/فروشات",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  },
  {
    id: "settings",
    title: "تنظیمات",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  },
];

const tabsEl = document.getElementById("tabs");
const mainArea = document.getElementById("mainArea");

function getAllowedTabsByRole(role) {
  const allTabs = [
    {
      id: "products",
      title: "اجناس",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
    },
    {
      id: "suppliers",
      title: "تامین‌کنندگان",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    },
    {
      id: "locations",
      title: "موقعیت‌های انبار",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    },
    {
      id: "transactions",
      title: "معاملات",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5M17 5l-3-3 3 3zM7 19h7.5M7 19l3 3-3-3z"></path></svg>',
    },
    {
      id: "expenses",
      title: "مصارف",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5M17 5l-3-3 3 3zM7 19h7.5M7 19l3 3-3-3z"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
    },
    {
      id: "salaries",
      title: "معاشات",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>',
    },
    {
      id: "reports",
      title: "گزارش",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2"/><circle cx="12" cy="16" r="5"/><path d="M12 11v5"/></svg>',
    },
    {
      id: "invoices",
      title: "بل/فروشات",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    },
    {
      id: "settings",
      title: "تنظیمات",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    },
  ];
  if (role === "admin") return allTabs;
  if (role === "finance") {
    return allTabs.filter((t) =>
      [
        "products",
        "suppliers",
        "locations",
        "transactions",
        "invoices",
        "expenses",
        "reports",
        "salaries",
        "settings",
      ].includes(t.id),
    );
  }
  if (role === "admin_staff") {
    return allTabs.filter((t) =>
      ["products", "suppliers", "locations", "salaries", "settings"].includes(
        t.id,
      ),
    );
  }
  return [];
}

function renderTabs() {
  const allowedTabs = getAllowedTabsByRole(currentUserRole);
  tabsEl.innerHTML = "";
  allowedTabs.forEach((t) => {
    const b = document.createElement("button");
    b.className = "tab" + (t.id === "products" ? " active" : "");
    b.innerHTML = `${t.icon} ${t.title}`;
    b.onclick = () => {
      document
        .querySelectorAll(".tab")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderMain(t.id);
    };
    tabsEl.appendChild(b);
  });
}

/********** utility: compute stock ***********/
function getStockForProduct(productId) {
  const txs = DB.data.transactions.filter((t) => t.productId === productId);
  let qty = 0;
  txs.forEach((t) => {
    if (t.type === "in") qty += Number(t.qty);
    else if (t.type === "out") qty -= Number(t.qty);
    else if (t.type === "adjust") qty = Number(t.qty);
  });
  return qty;
}

// ----------------------- Notification helpers (clean, robust) -----------------------
(function () {
  const bellBox = document.querySelector(".bell_box");
  const bellIcon =
    document.querySelector(".bell_box .bi-bell-fill") ||
    document.querySelector(".bi-bell-fill");
  const badge = document.getElementById("alarmCount");
  const notifBox = document.querySelector(".notification_message_box");
  const notifTable = document.getElementById("notification_message");
  const clearBtn = document.getElementById("clearNotificationsBtn");

  if (!bellBox || !badge || !notifBox || !notifTable) {
    console.warn(
      "Notification UI elements missing. Make sure HTML contains bell_box, #alarmCount, .notification_message_box and #notification_message.",
    );
    window.NotificationsAPI = {
      addLowStock: function () {
        console.warn("Notification UI missing - cannot add notifications.");
      },
      clear: function () {
        console.warn("Notification UI missing - clear noop.");
      },
      setCount: function () {},
    };
    return;
  }

  function clearNotifications() {
    notifTable.innerHTML = "";
    setBadgeCount(0);
  }

  function setBadgeCount(n) {
    if (!badge) return;
    if (n > 0) {
      badge.style.display = "flex";
      badge.textContent = String(n);
    } else {
      badge.style.display = "none";
      badge.textContent = "0";
    }
  }

  function addLowStockRow(obj) {
    if (!notifTable) return;
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f5f6f8";
    tr.style.fontSize = "13px";
    tr.style.padding = "6px";
    tr.dataset.productId = obj.id || "";
    tr.innerHTML = `
      <td style="padding:8px;vertical-align:middle;width:48px">
        <div style="width:32px;height:32px;border-radius:8px;background:#fff9f2;display:flex;align-items:center;justify-content:center;font-weight:700;color:#df9a04">
          !
        </div>
      </td>
      <td style="padding:2px;vertical-align:middle">
        <div style="font-weight:600">${escapeHtml(obj.name || "-")}</div>
        <div class="muted notifcation_muted">موجودی: ${Number(obj.stock || 0)} — حداقل: ${Number(obj.minStock || 0)} — موقعیت: ${escapeHtml(obj.location || "-")}</div>
      </td>
      <td style="display: none; padding:8px;vertical-align:middle;text-align:center">
        <button class="btn small view_btn" data-id="${obj.id || ""}" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
</svg>
</button>
      </td>
    `;
    const btn = tr.querySelector(".view_btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const pid = btn.dataset.id;
        console.debug("view low-stock product", pid);
        const rowEl = document.querySelector(`[data-id='${pid}']`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
          rowEl.style.outline = "2px solid #f59e0b";
          setTimeout(() => (rowEl.style.outline = ""), 2200);
        }
      });
    }

    notifTable.appendChild(tr);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showLowStockNotifications(list) {
    notifTable.innerHTML = "";
    if (!Array.isArray(list) || list.length === 0) {
      setBadgeCount(0);
      const r = document.createElement("tr");
      r.innerHTML = `<td style="padding:12px;color:#6b7280">کالایی زیر حداقل موجود نیست</td>`;
      notifTable.appendChild(r);
      return;
    }
    list.forEach(addLowStockRow);
    setBadgeCount(list.length);
  }

  function openBox() {
    notifBox.style.display = "block";
    bellBox.setAttribute("aria-expanded", "true");
  }
  function closeBox() {
    notifBox.style.display = "none";
    bellBox.setAttribute("aria-expanded", "false");
  }
  function toggleBox(e) {
    e.stopPropagation();
    if (notifBox.style.display === "block") closeBox();
    else openBox();
  }

  bellBox.addEventListener("click", toggleBox);
  document.addEventListener("click", (e) => {
    if (!notifBox.contains(e.target) && !bellBox.contains(e.target)) closeBox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBox();
  });
  if (clearBtn) clearBtn.addEventListener("click", clearNotifications);

  window.NotificationsAPI = {
    showLowStockNotifications,
    clearNotifications,
    setBadgeCount,
  };

  setBadgeCount(0);
  notifBox.style.display = "none";
})();
async function showSupplierDebtDetails(supplierId, supplierName) {
  try {
    // 1. دریافت همه تراکنش‌های ورودی این تامین‌کننده (بدون فیلتر باقی‌مانده)
    const res = await fetch(
      `${API_BASE}/transactions?supplierId=${supplierId}&type=in&limit=1000`,
    );
    if (!res.ok) throw new Error("خطا در دریافت تراکنش‌ها");
    let txs = await res.json();

    if (txs.length === 0) {
      alert("هیچ تراکنش ورودی برای این تامین‌کننده وجود ندارد.");
      return;
    }

    // 2. دریافت تاریخچه پرداخت و تصاویر برای هر تراکنش
    const paymentsMap = new Map();
    const attachmentsMap = new Map();
    for (const tx of txs) {
      try {
        const [payRes, attRes] = await Promise.all([
          fetch(`${API_BASE}/transactions/${tx.id}/payments`),
          fetch(`${API_BASE}/transactions/${tx.id}/attachments`),
        ]);
        if (payRes.ok) paymentsMap.set(tx.id, await payRes.json());
        if (attRes.ok) attachmentsMap.set(tx.id, await attRes.json());
      } catch (e) {
        console.warn(e);
      }
    }

    // 3. محاسبه آمار کلی (فقط برای تراکنش‌هایی که هنوز بدهی دارند - اختیاری)
    // 3. محاسبه آمار کلی (جداگانه برای بدهی و تخفیف)
    let totalQuantity = 0;
    let totalPurchase = 0;
    let totalPaid = 0;
    let totalRemainingDebt = 0; // فقط بدهی‌های واقعی
    let totalRemainingDiscount = 0; // تخفیف‌ها

    for (const tx of txs) {
      const qty = Number(tx.qty) || 0;
      const unitPrice = Number(tx.unit_price) || 0;
      const paid = Number(tx.paid_to_supplier) || 0;
      const total = qty * unitPrice;
      const remaining = total - paid;
      const isDebt = tx.supplier_remaining_action === "debt";

      totalQuantity += qty;
      totalPurchase += total;
      totalPaid += paid;

      if (isDebt) {
        totalRemainingDebt += remaining;
      } else {
        totalRemainingDiscount += remaining;
      }
    }
    // 4. ساخت HTML مودال با بخش آمار و جدول کامل
    let html = `<h3>جزئیات خریداری از تامین‌کننده: ${escapeHtml(supplierName)}</h3>`;
    // ساخت HTML بخش آمار
    html += `
  <div style="display: flex; gap: 16px; flex-wrap: wrap; background: #f8fafc; padding: 12px; border-radius: 12px; margin-bottom: 16px;">
    <div><strong>📦 تعداد کل خرید:</strong> ${totalQuantity}</div>
    <div><strong>💰 جمع کل خرید:</strong> ${totalPurchase.toFixed(2)} $</div>
    <div><strong>💵 جمع پرداخت شده:</strong> ${totalPaid.toFixed(2)} $</div>
    <div><strong>📉 جمع بدهی:</strong> ${totalRemainingDebt.toFixed(2)} $</div>
    <div><strong>🏷️ جمع تخفیف دریافتی:</strong> ${totalRemainingDiscount.toFixed(2)} $</div>
  </div>
`;

    // جدول اصلی
    html += `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead style="background:#f0f0f0;">
          <tr><th>تاریخ</th><th>توضیحات</th><th>کالا</th><th>تعداد</th>
            <th>قیمت واحد</th><th>کل خرید</th><th>پرداخت شده</th>
            <th>باقی‌مانده</th><th>نوع</th><th>تاریخچه پرداخت</th><th>ضمیمه‌ها</th><th>عملیات</th>
          </tr>
        </thead>
        <tbody>`;

    for (const tx of txs) {
      const qty = Number(tx.qty) || 0;
      const unitPrice = Number(tx.unit_price) || 0;
      const paid = Number(tx.paid_to_supplier) || 0;
      const total = qty * unitPrice;
      const remaining = total - paid;
      const actionType =
        tx.supplier_remaining_action === "debt" ? "بدهی" : "تخفیف";

      let productName = "-";
      const prod = DB.data.products?.find((p) => p.id === tx.product_id);
      productName = prod ? prod.name : tx.product_name || "-";

      const payments = paymentsMap.get(tx.id) || [];
      const paymentsHtml = payments.length
        ? payments
            .map(
              (p) =>
                `${new Date(p.date).toLocaleDateString("fa-IR")}: ${Number(p.amount).toFixed(2)} $`,
            )
            .join("<br>")
        : "—";

      const attachments = attachmentsMap.get(tx.id) || [];
      const attachmentsHtml = attachments.length
        ? `<button class="btn-link view-attachments" data-txid="${tx.id}">📎 ${attachments.length}</button>`
        : "—";

      // تعیین وضعیت عملیات
      let payButton = "";
      if (actionType === "بدهی") {
        if (remaining > 0.01) {
          payButton = `<button class="btn small pay-transaction-btn" data-txid="${tx.id}" data-max="${remaining.toFixed(2)}">💰 پرداخت</button>`;
        } else {
          payButton = `<button class="btn small" disabled style="background:#aaa;">✅ تسویه شده</button>`;
        }
      } else {
        // نوع تخفیف
        if (remaining > 0.01) {
          payButton = `<button class="btn small" disabled style="background:#ccc;">❌ تخفیف (غیرقابل پرداخت)</button>`;
        } else {
          payButton = `<button class="btn small" disabled style="background:#aaa;">✅ تسویه شده (تخفیف)</button>`;
        }
      }

      html += `
        <tr data-txid="${tx.id}">
          <td>${tx.date?.split("T")[0] || "-"}</td>
          <td>${escapeHtml(tx.description || "")}</td>
          <td>${productName}</td>
          <td style="text-align:center">${qty}</td>
          <td style="text-align:center">${unitPrice.toFixed(2)}</td>
          <td style="text-align:center">${total.toFixed(2)}</td>
          <td class="paid-cell-${tx.id}" style="text-align:center">${paid.toFixed(2)}</td>
          <td class="remaining-cell-${tx.id}" style="text-align:center; font-weight:bold;">${remaining.toFixed(2)}</td>
          <td style="text-align:center">${actionType}</td>
          <td style="font-size:12px;">${paymentsHtml}</td>
          <td style="text-align:center">${attachmentsHtml}</td>
          <td style="text-align:center">${payButton}</td>
        </tr>
      `;
    }

    html += `</tbody></table></div>
    <div class="form-actions" style="position:relative;margin-top:16px;"><button id="closeDebtModal" class="btn ghost"  style="position:fixed;bottom:81px">بستن</button></div>`;

    // نمایش مودال
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-card" style="max-width:1100px; max-height:80vh; overflow:auto;">${html}</div>`;
    document.body.appendChild(modal);
    modal.querySelector("#closeDebtModal").onclick = () => modal.remove();

    // رویداد پرداخت (بدون تغییر)
    modal.querySelectorAll(".pay-transaction-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const txId = btn.getAttribute("data-txid");
        const maxRemaining = parseFloat(btn.getAttribute("data-max"));
        let amount = prompt(
          `مبلغ پرداختی (حداکثر ${maxRemaining.toFixed(2)} $):`,
          maxRemaining.toFixed(2),
        );
        if (!amount) return;
        let payAmount = parseFloat(amount.replace(/,/g, "."));
        if (isNaN(payAmount) || payAmount <= 0 || payAmount > maxRemaining) {
          alert("مبلغ نامعتبر");
          return;
        }

        try {
          const updateRes = await fetch(
            `${API_BASE}/transactions/${txId}/payment`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: payAmount,
                date: new Date().toISOString(),
              }),
            },
          );
          if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(err.error || "خطا در ثبت پرداخت");
          }
          const updatedTx = await updateRes.json();

          const newPaid = Number(updatedTx.paid_to_supplier) || 0;
          const newQty = Number(updatedTx.qty) || 0;
          const newUnitPrice = Number(updatedTx.unit_price) || 0;
          const newTotal = newQty * newUnitPrice;
          const newRemaining = newTotal - newPaid;

          const row = btn.closest("tr");
          row.querySelector(`.paid-cell-${txId}`).innerText =
            newPaid.toFixed(2);
          row.querySelector(`.remaining-cell-${txId}`).innerText =
            newRemaining.toFixed(2);
          btn.setAttribute("data-max", newRemaining.toFixed(2));

          // به‌روزرسانی تاریخچه پرداخت
          const paymentsCell = row.querySelector("td:nth-child(10)");
          const today = new Date().toLocaleDateString("fa-IR");
          const newPaymentLine = `${today}: ${payAmount.toFixed(2)} $`;
          if (paymentsCell.innerText === "—") {
            paymentsCell.innerText = newPaymentLine;
          } else {
            paymentsCell.innerHTML = `${paymentsCell.innerHTML}<br>${newPaymentLine}`;
          }

          if (newRemaining <= 0.01) {
            // تبدیل دکمه به "تسویه شده"
            btn.remove();
            const doneSpan = document.createElement("button");
            doneSpan.className = "btn small";
            doneSpan.disabled = true;
            doneSpan.style.background = "#aaa";
            doneSpan.innerText = "✅ تسویه شده";
            row.querySelector("td:last-child").appendChild(doneSpan);
          }

          // به‌روزرسانی آمار (می‌توانید مودال را ببندید و دوباره باز کنید)
          modal.remove();
          await DB.load();
          renderMain("suppliers");
          await showSupplierDebtDetails(supplierId, supplierName);
          alert("✅ پرداخت با موفقیت ثبت شد.");
        } catch (err) {
          alert("خطا: " + err.message);
        }
      });
    });

    // رویداد نمایش تصاویر
    modal.querySelectorAll(".view-attachments").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const txId = btn.getAttribute("data-txid");
        try {
          const res = await fetch(
            `${API_BASE}/transactions/${txId}/attachments`,
          );
          if (!res.ok) throw new Error("خطا در دریافت تصاویر");
          const atts = await res.json();
          if (!atts.length) {
            alert("هیچ تصویری وجود ندارد");
            return;
          }
          let imgHtml = `<h4>تصاویر فاکتور</h4><div class="show_file_box" style="display:flex;flex-wrap:wrap;">`;
          for (const a of atts) {
            if (!a.file_data) continue;
            imgHtml += `<div style="margin:5px;"><img src="${a.file_data}" style="max-width:200px; max-height:200px; cursor:pointer;" onclick="window.open(this.src)"/><div>${escapeHtml(a.filename)}</div></div>`;
          }
          imgHtml += `</div><button class="btn" id="closeImgModal">بستن</button>`;
          const imgModal = document.createElement("div");
          imgModal.className = "modal-overlay";
          imgModal.innerHTML = `<div class="modal-card">${imgHtml}</div>`;
          document.body.appendChild(imgModal);
          imgModal.querySelector("#closeImgModal").onclick = () =>
            imgModal.remove();
        } catch (err) {
          alert("خطا: " + err.message);
        }
      });
    });
  } catch (err) {
    console.error(err);
    alert("خطا در دریافت اطلاعات بدهی: " + err.message);
  }
}
async function renderUsers() {
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="card_box_header">
      <h3>مدیریت کاربران</h3>
      <button id="newUserBtn" class="btn small">+ کاربر جدید</button>
    </div>
    <div class="card">
      <div id="usersList"></div>
    </div>
  `;
  mainArea.appendChild(container);

  async function loadUsers() {
    const res = await fetch(API_BASE + "/users");
    if (!res.ok) return;
    const users = await res.json();
    const listDiv = container.querySelector("#usersList");
    if (!users.length) {
      listDiv.innerHTML = '<div class="muted">هیچ کاربری یافت نشد</div>';
      return;
    }
    listDiv.innerHTML = users
      .map(
        (u) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
        <div>
          <strong>${escapeHtml(u.username)}</strong>
          <div class="muted small">نقش: ${translateRole(u.role)} — تاریخ عضویت: ${new Date(u.created_at).toLocaleDateString("fa-IR")}</div>
        </div>
        <button class="btn small danger delete-user" data-id="${u.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>
      </div>
    `,
      )
      .join("");

    listDiv.querySelectorAll(".delete-user").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("آیا از حذف این کاربر اطمینان دارید؟")) return;
        const id = btn.dataset.id;
        const res = await fetch(API_BASE + "/users/" + id, {
          method: "DELETE",
        });
        if (res.ok) loadUsers();
        else alert("خطا در حذف کاربر");
      };
    });
  }

  // ========== مودال ایجاد کاربر جدید با استایل جدید ==========
  container.querySelector("#newUserBtn").onclick = () => {
    // ایجاد لایه پشت‌زمینه (overlay)
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    // ایجاد کارت مودال
    const modal = document.createElement("div");
    modal.className = "modal-card";

    modal.innerHTML = `
      <h3>کاربر جدید</h3>
      <form id="createUserForm">
        <label>نام کاربری</label>
        <input name="username" required>
        <label>رمز عبور</label>
        <input name="password" type="password" required>
        <label>نقش</label>
        <select name="role">
          <option value="admin_staff">مدیر اداری</option>
          <option value="finance">مدیر مالی</option>
          <option value="admin">مدیر کل</option>
        </select>
        <div class="form-actions">
          <button type="submit" class="btn">ایجاد</button>
          <button type="button" id="cancelUserForm" class="btn ghost">انصراف</button>
        </div>
      </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    modal.querySelector("#cancelUserForm").onclick = closeModal;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    modal.querySelector("#createUserForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        username: formData.get("username"),
        password: formData.get("password"),
        role: formData.get("role"),
      };
      const res = await fetch(API_BASE + "/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        closeModal();
        loadUsers();
      } else {
        const err = await res.json();
        alert("خطا: " + (err.error || "نام کاربری تکراری است"));
      }
    };
  };

  loadUsers();
}

/********** Render each tab ***********/
function renderMain(tabId) {
  // بررسی دسترسی به تب
  const allowedTabs = getAllowedTabsByRole(currentUserRole);
  if (!allowedTabs.some((t) => t.id === tabId)) {
    mainArea.innerHTML =
      '<div class="card"><p>⛔ شما دسترسی به این بخش ندارید.</p></div>';
    return;
  }

  currentActiveTab = tabId;
  updateMobileNavActive();
  mainArea.innerHTML = "";
  if (tabId === "products") renderProducts();
  else if (tabId === "suppliers") renderSuppliers();
  else if (tabId === "locations") renderLocations();
  else if (tabId === "transactions") renderTransactions();
  else if (tabId === "expenses") renderExpenses();
  else if (tabId === "salaries") renderSalaries();
  else if (tabId === "reports") renderReports();
  else if (tabId === "invoices") renderInvoices();
  else if (tabId === "users") renderUsers();
  else if (tabId === "settings") {
    const settingsContent = document.getElementById("settings-content");
    if (settingsContent) {
      mainArea.innerHTML = settingsContent.innerHTML;

      // ---------- نمایش نام کاربری و نقش در تنظیمات ----------
      const settingsUsernameEl = mainArea.querySelector(
        "#dropdownUsername_setting",
      );
      const settingsRoleEl = mainArea.querySelector(
        "#dropdownUserRole_setting",
      );
      if (settingsUsernameEl) {
        settingsUsernameEl.textContent = currentUsername || "کاربر";
      }
      if (settingsRoleEl) {
        let roleText = "";
        if (currentUserRole === "admin") roleText = "مدیر کل";
        else if (currentUserRole === "finance") roleText = "مدیر مالی";
        else if (currentUserRole === "admin_staff") roleText = "مدیر اداری";
        else roleText = "کاربر";
        settingsRoleEl.textContent = roleText;
      }

      // ---------- دکمه تغییر رمز عبور (برای همه کاربران) ----------
      let changePasswordBtn = mainArea.querySelector(
        "#changePasswordInSettings",
      );
      if (!changePasswordBtn) {
        const userInfoBox = mainArea.querySelector(".user_info");
        if (userInfoBox) {
          const btn = document.createElement("button");
          btn.id = "changePasswordInSettings";
          btn.className = "btn small";
          btn.textContent = "🔑 تغییر رمز عبور";
          btn.style.marginLeft = "10px";
          userInfoBox.appendChild(btn);
          changePasswordBtn = btn;
        }
      }
      if (changePasswordBtn) {
        const newBtn = changePasswordBtn.cloneNode(true);
        changePasswordBtn.parentNode.replaceChild(newBtn, changePasswordBtn);
        newBtn.addEventListener("click", () => {
          if (typeof showPasswordChangeModal === "function") {
            showPasswordChangeModal(currentUserId, currentUsername, true);
          } else {
            console.error("showPasswordChangeModal is not defined");
            alert("خطا: تابع تغییر رمز یافت نشد. لطفاً صفحه را رفرش کنید.");
          }
        });
      }

      // ---------- مدیریت کاربران (فقط ادمین) ----------
      if (currentUserRole === "admin") {
        if (!mainArea.querySelector(".users-management-section")) {
          addUsersManagementToSettings(mainArea);
        }
      }

      // ---------- مخفی کردن دکمه‌های حساس برای غیرادمین ----------
      if (currentUserRole !== "admin" && currentUserRole !== "finance") {
        const adminButtons = mainArea.querySelectorAll(
          "#exportJson, #importJson, #clearData, #seedData, .backup_btn",
        );
        adminButtons.forEach((btn) => {
          if (btn) btn.style.display = "none";
        });
      }

      // ---------- دکمه خروج از حساب ----------
      const logoutBtn = mainArea.querySelector("#logoutBtn");
      if (logoutBtn) {
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener("click", async () => {
          const res = await fetch("/api/logout", { method: "POST" });
          if (res.ok) window.location.href = "/login";
        });
      }
    }
  }
}

function renderInvoices() {
  const c = document.createElement("div");
  c.innerHTML = `
    <div class="card_box_header">
      <h3 style="margin:0">بل فروشات</h3>
      <div class="stats" style="display:flex;align-items:center;gap:20px;">
        <div class="innerbox_header" style="font-size:14px; padding:6px 12px; border-radius:20px;">
          <span>📊 تعداد بل: <strong id="totalInvoicesCount">0</strong></span>
          <span style="margin:0 8px;">|</span>
          <span>💰 جمع کل: <strong id="totalAmountSum">0.00</strong> $</span>
          <span style="margin:0 8px;">|</span>
          <span>💵 پرداخت شده: <strong id="totalPaidSum">0.00</strong> $</span>
          <span style="margin:0 8px;">|</span>
          <span>⏳ باقی‌مانده: <strong id="totalRemainingSum">0.00</strong> $</span>
          <span style="margin:0 8px;">|</span>
          <span style="color:#b91c1c;">📉 بدهی: <strong id="totalDebtSum">0.00</strong> $</span>
          <span style="margin:0 8px;">|</span>
          <span style="color:#0b5e8a;">🏷️ تخفیف: <strong id="totalDiscountSum">0.00</strong> $</span>
        </div>
      </div>
      <button id="newInvoice" class="btn small">فروش جدید</button>
    </div>
    <div class="filters filters_sales" style="display:flex; flex-wrap:wrap; gap:10px; padding:10px; margin-top:10px;  border-radius:8px;">
      <input type="text" id="filterCustomerName" placeholder=" مشتری..." style="flex:2; min-width:150px;">
      <input type="date" id="filterDateFrom" placeholder="از تاریخ">
      <span>تا</span>
      <input type="date" id="filterDateTo" placeholder="تا تاریخ">
      <select id="filterRemainingType">
        <option value="all">همه</option>
        <option value="debt">بدهی</option>
        <option value="discount">تخفیف</option>
      </select>
      <button id="resetFilters" class="btn small ghost">حذف فیلترها</button>
    </div>
    <div style="margin-top:10px" class="card list">
      <div id="invoiceList"></div>
    </div>
  `;
  mainArea.appendChild(c);

  const newInvoiceBtn = c.querySelector("#newInvoice");
  newInvoiceBtn.onclick = () => showInvoiceForm();

  const filterCustomer = c.querySelector("#filterCustomerName");
  const filterDateFrom = c.querySelector("#filterDateFrom");
  const filterDateTo = c.querySelector("#filterDateTo");
  const filterRemainingType = c.querySelector("#filterRemainingType");
  const resetBtn = c.querySelector("#resetFilters");

  async function refreshInvoices() {
    const customerQuery = filterCustomer.value.trim().toLowerCase();
    const dateFrom = filterDateFrom.value
      ? new Date(filterDateFrom.value)
      : null;
    let dateTo = filterDateTo.value ? new Date(filterDateTo.value) : null;
    if (dateTo) dateTo.setHours(23, 59, 59, 999);
    const remainingType = filterRemainingType.value;

    // فیلتر کردن فاکتورها
    let filteredInvoices = DB.data.invoices.filter((inv) => {
      const invDate = new Date(inv.date);
      const remaining =
        (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0);
      if (
        customerQuery &&
        !(inv.customer_name || "").toLowerCase().includes(customerQuery)
      )
        return false;
      if (dateFrom && invDate < dateFrom) return false;
      if (dateTo && invDate > dateTo) return false;
      if (
        remainingType === "debt" &&
        !(remaining > 0 && inv.remaining_action === "debt")
      )
        return false;
      if (
        remainingType === "discount" &&
        !(remaining > 0 && inv.remaining_action === "discount")
      )
        return false;
      return true;
    });

    // محاسبه آمار (با تبدیل اعداد)
    const totalCount = filteredInvoices.length;
    const totalAmount = filteredInvoices.reduce(
      (s, inv) => s + (Number(inv.total) || 0),
      0,
    );
    const totalPaid = filteredInvoices.reduce(
      (s, inv) => s + (Number(inv.paid_amount) || 0),
      0,
    );
    const totalRemaining = totalAmount - totalPaid;
    let totalDebt = 0,
      totalDiscount = 0;
    filteredInvoices.forEach((inv) => {
      const remaining =
        (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0);
      if (remaining > 0) {
        if (inv.remaining_action === "debt") totalDebt += remaining;
        else totalDiscount += remaining;
      }
    });

    // به‌روزرسانی المان‌های آمار
    document.getElementById("totalInvoicesCount").textContent = totalCount;
    document.getElementById("totalAmountSum").textContent =
      totalAmount.toFixed(2);
    document.getElementById("totalPaidSum").textContent = totalPaid.toFixed(2);
    document.getElementById("totalRemainingSum").textContent =
      totalRemaining.toFixed(2);
    document.getElementById("totalDebtSum").textContent = totalDebt.toFixed(2);
    document.getElementById("totalDiscountSum").textContent =
      totalDiscount.toFixed(2);

    // ساخت لیست
    const listDiv = c.querySelector("#invoiceList");
    if (filteredInvoices.length === 0) {
      listDiv.innerHTML =
        '<div class="muted" style="padding:12px">هیچ فاکتوری با فیلترهای انتخاب شده یافت نشد.</div>';
      return;
    }

    async function getItemCount(invoiceId) {
      try {
        const resp = await fetch(API_BASE + "/invoices/" + invoiceId);
        if (!resp.ok) return "?";
        const data = await resp.json();
        return data.items ? data.items.length : "?";
      } catch {
        return "?";
      }
    }

    const promises = filteredInvoices.map(async (inv) => {
      const total = Number(inv.total) || 0;
      const paid = Number(inv.paid_amount) || 0;
      const remaining = total - paid;
      const hasDebt = inv.remaining_action === "debt" && remaining > 0;
      const itemCount = await getItemCount(inv.id);
      const debtButton = hasDebt
        ? `<button class="btn small pay-debt" data-id="${inv.id}" data-remaining="${remaining}">💰 پرداخت بدهی</button>`
        : "";
      return `
        <div class="report_section_debt_box" style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #f5f6f8; ${hasDebt ? "background:#ff00001a;" : ""}">
          <div>
            <strong>${inv.id}</strong>
            <div class="muted small">${inv.customer_name || "-"} — ${inv.date ? inv.date.split("T")[0] : ""} — تعداد کالا: ${itemCount}</div>
            <div class="muted small">جمله: ${total.toFixed(2)} $ | پرداخت: ${paid.toFixed(2)} $ | باقی: ${remaining.toFixed(2)} $ (${inv.remaining_action === "debt" ? "بدهی" : "تخفیف"})</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn small" data-id="${inv.id}" data-action="view">مشاهده</button>
            <button class="btn small danger" data-id="${inv.id}" data-action="delete">حذف</button>
            ${debtButton}
          </div>
        </div>
      `;
    });
    const htmlArray = await Promise.all(promises);
    listDiv.innerHTML = htmlArray.join("");
    attachInvoiceButtons(listDiv);
    attachDebtPaymentHandlers(listDiv);
  }

  function attachInvoiceButtons(container) {
    container.querySelectorAll('button[data-action="view"]').forEach((b) => {
      b.onclick = async () => {
        const id = b.getAttribute("data-id");
        const invFull = await DB.getInvoice(id);
        const customer =
          DB.data.customers.find((c) => c.id === invFull.invoice.customer_id) ||
          null;
        openReceiptWindow(invFull.invoice, invFull.items, customer);
      };
    });
    container.querySelectorAll('button[data-action="delete"]').forEach((b) => {
      b.onclick = async () => {
        const id = b.getAttribute("data-id");
        if (
          !confirm("آیا از حذف این بل اطمینان دارید؟ این عمل برگشت‌ناپذیر است.")
        )
          return;
        try {
          await DB.deleteInvoice(id);
          await DB.load();
          renderMain("invoices");
        } catch (err) {
          console.error(err);
          alert("خطا در حذف بل: " + err.message);
        }
      };
    });
  }

  function attachDebtPaymentHandlers(container) {
    container.querySelectorAll(".pay-debt").forEach((btn) => {
      btn.onclick = async () => {
        const invoiceId = btn.getAttribute("data-id");
        const remaining = parseFloat(btn.getAttribute("data-remaining"));
        if (isNaN(remaining)) return;
        const defaultAmount = remaining.toFixed(2);
        let userInput = prompt(
          `مبلغ پرداختی را وارد کنید (حداکثر ${defaultAmount} $):`,
          defaultAmount,
        );
        if (!userInput) return;
        let cleaned = userInput.replace(/[^\d.,]/g, "");
        cleaned = cleaned.replace(/,/g, ".");
        const parts = cleaned.split(".");
        if (parts.length > 2)
          cleaned = parts[0] + "." + parts.slice(1).join("");
        let payAmount = parseFloat(cleaned);
        if (isNaN(payAmount) || payAmount <= 0 || payAmount > remaining) {
          alert(`لطفاً مبلغی بین 0 و ${remaining.toFixed(2)} وارد کنید.`);
          return;
        }
        payAmount = Math.round(payAmount * 100) / 100;
        try {
          const res = await fetch(`${API_BASE}/invoices/${invoiceId}/payment`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: payAmount }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "خطا در ثبت پرداخت");
          }
          alert("پرداخت با موفقیت ثبت شد.");
          await DB.load();
          renderMain("invoices");
        } catch (err) {
          alert("خطا: " + err.message);
        }
      };
    });
  }

  // اتصال رویدادهای فیلتر
  filterCustomer.addEventListener("input", () => refreshInvoices());
  filterDateFrom.addEventListener("change", () => refreshInvoices());
  filterDateTo.addEventListener("change", () => refreshInvoices());
  filterRemainingType.addEventListener("change", () => refreshInvoices());
  resetBtn.addEventListener("click", () => {
    filterCustomer.value = "";
    filterDateFrom.value = "";
    filterDateTo.value = "";
    filterRemainingType.value = "all";
    refreshInvoices();
  });

  refreshInvoices();
}

// Dark mode functionality
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
  updateDarkModeIcon();
}

function loadDarkModePreference() {
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "enabled") {
    document.body.classList.add("dark-mode");
  }
  updateDarkModeIcon();
}

function updateDarkModeIcon() {
  const btn = document.querySelector(".dark_mode_btn");
  if (!btn) return;
  const isDark = document.body.classList.contains("dark-mode");
  // آیکن ماه (برای دارک مود)
  const moonSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  // آیکن خورشید (برای لایت مود)
  const sunSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  btn.innerHTML = isDark ? moonSVG : sunSVG;
}

// رویداد کلیک دکمه دارک مود
document.addEventListener("DOMContentLoaded", () => {
  loadDarkModePreference();
  const darkModeBox = document.querySelector(".dark_mode_box");
  if (darkModeBox) {
    darkModeBox.addEventListener("click", toggleDarkMode);
  }
});
/********** Products ***********/

/* ---------- Serial numbers UI helpers ---------- */

async function fetchSerials(productId) {
  try {
    const resp = await fetch(
      `/api/products/${encodeURIComponent(productId)}/serials`,
    );
    if (!resp.ok) throw new Error("Failed to fetch serials");
    return await resp.json();
  } catch (e) {
    console.error("fetchSerials error", e);
    return [];
  }
}

function showSerialSelector(productId, qty, onSelect) {
  const modalId = "serial-selector-modal";
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = modalId;
  modal.style =
    "position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;";
  const inner = document.createElement("div");
  inner.style =
    "background:#fff;padding:16px;border-radius:8px;max-width:90%;max-height:80%;overflow:auto;";
  inner.innerHTML = `<h3>انتخاب سریال‌ها (نیاز به ${qty} عدد)</h3>
    <div id="serial-list">در حال بارگذاری...</div>
    <div style="margin-top:12px;text-align:right;">
      <button id="serial-cancel">لغو</button>
      <button id="serial-confirm" disabled>تأیید</button>
    </div>
  `;
  modal.appendChild(inner);
  document.body.appendChild(modal);

  const listDiv = inner.querySelector("#serial-list");
  const confirmBtn = inner.querySelector("#serial-confirm");
  const cancelBtn = inner.querySelector("#serial-cancel");

  fetchSerials(productId).then((rows) => {
    // فیلتر سریال‌های موجود
    const avail = rows.filter(
      (r) => r.status === "available" || r.status === "in" || r.status === null,
    );
    if (!avail || avail.length === 0) {
      listDiv.innerHTML = "<div>هیچ سریالی برای این محصول موجود نیست.</div>";
      return;
    }

    // گروه‌بندی سریال‌ها
    const serialGroups = {};
    avail.forEach((r) => {
      const serial = r.serial;
      if (!serialGroups[serial]) {
        serialGroups[serial] = {
          serial: serial,
          count: 0,
          selected: 0,
        };
      }
      serialGroups[serial].count++;
    });

    const groups = Object.values(serialGroups);
    let totalSelected = 0;

    // ایجاد المان برای هر گروه
    groups.forEach((group) => {
      const container = document.createElement("div");
      container.style =
        "display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #eee;";

      // نمایش نام سریال و موجودی
      const label = document.createElement("span");
      label.style = "flex:1;";
      label.textContent = `${group.serial} (موجودی: ${group.count})`;

      // اینپوت برای انتخاب تعداد
      const input = document.createElement("input");
      input.type = "number";
      input.min = 0;
      input.max = group.count;
      input.value = 0;
      input.style =
        "width:80px;padding:4px;border-radius:4px;border:1px solid #ccc;";

      input.addEventListener("input", () => {
        const val = parseInt(input.value) || 0;
        if (val < 0) input.value = 0;
        else if (val > group.count) input.value = group.count;

        group.selected = parseInt(input.value) || 0;

        // محاسبه مجموع انتخاب‌ها
        totalSelected = groups.reduce((sum, g) => sum + g.selected, 0);

        // فعال/غیرفعال کردن دکمه تأیید
        confirmBtn.disabled = totalSelected !== qty;
      });

      container.appendChild(label);
      container.appendChild(input);
      listDiv.appendChild(container);
    });
  });

  cancelBtn.addEventListener("click", () => {
    modal.remove();
  });

  confirmBtn.addEventListener("click", () => {
    const result = [];
    // خواندن مجدد مقادیر از DOM (برای اطمینان از آخرین تغییرات)
    const containers = Array.from(listDiv.children);
    containers.forEach((container) => {
      const label = container.querySelector("span");
      const input = container.querySelector("input");
      const serial = label.textContent.split(" (")[0]; // استخراج سریال
      const count = parseInt(input.value) || 0;
      for (let i = 0; i < count; i++) {
        result.push(serial);
      }
    });

    modal.remove();
    if (onSelect) onSelect(result);
  });
}

async function attachSerialsSummary(rowElement, productId) {
  try {
    const serials = await fetchSerials(productId);
    // فقط سریال‌های موجود (available) را نگه دارید
    const availableSerials = serials.filter(
      (s) => s.status === "available" || s.status === null || s.status === "in",
    );

    if (!availableSerials.length) {
      addSerialSummaryDiv(rowElement, "—");
      return;
    }

    // گروه‌بندی بر اساس مقدار سریال
    const serialCountMap = new Map();
    for (const s of availableSerials) {
      const val = s.serial;
      serialCountMap.set(val, (serialCountMap.get(val) || 0) + 1);
    }

    const groups = Array.from(serialCountMap.entries())
      .map(([serial, count]) => ({ serial, count }))
      .sort((a, b) => b.count - a.count);

    const maxDisplay = 3;
    const shown = groups.slice(0, maxDisplay);
    const remaining = groups.length - maxDisplay;

    let serialsText = "";
    for (let i = 0; i < shown.length; i++) {
      const g = shown[i];
      serialsText += `${g.serial} (${g.count})`;
      if (i < shown.length - 1 || remaining > 0) serialsText += ", ";
    }
    if (remaining > 0) {
      serialsText += `+ ${remaining} سریال دیگر`;
    }

    addSerialSummaryDiv(rowElement, serialsText);
  } catch (err) {
    console.error("attachSerialsSummary error", err);
    addSerialSummaryDiv(rowElement, "خطا در دریافت سریال‌ها");
  }
}

function addSerialSummaryDiv(rowElement, text) {
  let summaryDiv = rowElement.querySelector(".product-serial-summary");
  if (!summaryDiv) {
    summaryDiv = document.createElement("div");
    summaryDiv.className = "product-serial-summary";
    summaryDiv.style.cssText =
      "font-size: 11px; color: #6b7280; margin-top: 4px;";
    // پیدا کردن جایی که می‌خواهیم نمایش دهیم (مثلاً بعد از اطلاعات قیمت)
    const target =
      rowElement.querySelector(".price-info") ||
      rowElement.querySelector("div:first-child");
    if (target && target.parentNode) {
      target.parentNode.insertBefore(summaryDiv, target.nextSibling);
    } else {
      rowElement.appendChild(summaryDiv);
    }
  }
  summaryDiv.innerHTML = `🔢 سریال نمبر: ${text}`;
}

// function renderProducts() {
//   const c = document.createElement("div");
//   c.innerHTML = `
//           <div style="display:flex;justify-content:space-between;align-items:center">
//             <h3 style="margin:0">اجناس</h3>
//             <button id="addProduct" class="btn small card_tital_box"><svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"></path></svg> افزودن جنس جدید</button>
//           </div>
//           <div style="margin-top:10px" class="card list">
//             <div class="search">
//               <input id="productSearch" placeholder="نام/کد/دسته‌بندی" style="flex:1">
//               <select id="productLocationFilter"><option value="">همه موقعیت‌ها</option></select>
//             </div>
//             <div id="productList"></div>
//           </div>
//         `;
//   mainArea.appendChild(c);

//   const locSel = c.querySelector("#productLocationFilter");
//   locSel.innerHTML =
//     '<option value="">همه موقعیت‌ها</option>' +
//     DB.data.locations
//       .map((l) => `<option value="${l.id}">${l.name}</option>`)
//       .join("");

//   c.querySelector("#addProduct").onclick = () => showProductForm();
//   c.querySelector("#productSearch").oninput = () => drawProductList();
//   c.querySelector("#productLocationFilter").onchange = () => drawProductList();

//   drawProductList();

//   function drawProductList() {
//     const q = c.querySelector("#productSearch").value.trim().toLowerCase();
//     const loc = c.querySelector("#productLocationFilter").value;
//     const container = c.querySelector("#productList");
//     const rows = DB.data.products
//       .filter((p) => {
//         if (q) {
//           if (
//             !(
//               p.name.toLowerCase().includes(q) ||
//               (p.sku || "").toLowerCase().includes(q) ||
//               (p.category || "").toLowerCase().includes(q)
//             )
//           )
//             return false;
//         }
//         if (loc && p.locationId !== loc) return false;
//         return true;
//       })
//       .map((p) => {
//         const stock = getStockForProduct(p.id);
//         const locName =
//           DB.data.locations.find((x) => x.id === p.locationId)?.name || "-";
//         return `
//               <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid #f5f6f8">
//                 <div style="flex:1">
//                   <div><strong>${p.name}</strong> <span class="muted">(${p.sku || "-"})</span></div>
//                   <div class="muted small">دسته: ${p.category || "-"} — موقعیت: ${locName}</div>
//                 </div>
//                 <div style="text-align:center;margin-left:12px">
//                   <div style="font-weight:600">${stock}</div>
//                   <div class="muted small">موجودی</div>
//                 </div>
//                 <div style="display:flex;gap:6px;margin-left:12px">
//                   <button class="btn ghost small" data-id="${p.id}" data-action="receive">ورود</button>
//                   <button  class="btn ghost small" data-id="${p.id}" data-action="ship">خروج</button>
//                   <button class="btn small" data-id="${p.id}" data-action="edit">ویرایش</button>
//                 </div>
//               </div>
//             `;
//       })
//       .join("");
//     container.innerHTML =
//       rows || '<div class="muted" style="padding:12px">موردی یافت نشد</div>';

//     container.querySelectorAll("button").forEach((b) => {
//       b.onclick = () => {
//         const id = b.getAttribute("data-id");
//         const action = b.getAttribute("data-action");
//         if (action === "receive") showTransactionForm(id, "in");
//         if (action === "ship") showTransactionForm(id, "out");
//         if (action === "edit") showProductForm(id);
//       };
//     });
//   }
// }
// محاسبه مجموع قیمت خرید و فروش سریال‌های موجود یک محصول
function getTotalPricesFromSerials(productId) {
  let totalPurchase = 0;
  let totalSale = 0;
  if (!DB.data.serials) return { totalPurchase, totalSale };
  const productSerials = DB.data.serials.filter(
    (s) =>
      s.product_id === productId &&
      (s.status === "available" || s.status === "in" || s.status === null),
  );
  for (const s of productSerials) {
    if (s.purchase_price) totalPurchase += Number(s.purchase_price);
    if (s.sale_price) totalSale += Number(s.sale_price);
  }
  return { totalPurchase, totalSale };
}
function renderProducts() {
  const c = document.createElement("div");

  // HTML اولیه با placeholder برای مقادیر آماری
  c.innerHTML = `
    <div class="card_box_header">
      <h3 style="margin:0">اجناس</h3>
      <div style="display:flex;align-items:center;gap:20px;">
        <div class="innerbox_header" style="font-size:14px; padding:6px 12px; border-radius:20px;">
          <span>💰 هزینه کل: <strong id="totalPurchaseDisplay">0.00</strong> $</span>
          <span style="margin:0 10px;">|</span>
          <span>💵 فروش کل: <strong id="totalSaleDisplay">0.00</strong> $</span>
        </div>

      </div>
              <button id="addProduct" class="btn small card_tital_box">
          <svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" fill="currentColor" viewBox="0 0 256 256">
            <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"></path>
          </svg> افزودن جنس جدید
        </button>
    </div>
    <div style="margin-top:10px" class="card list">
      <div class="search">
        <input id="productSearch" placeholder="نام/کد/دسته‌بندی" style="flex:1">
        <select id="productLocationFilter"><option value="">همه موقعیت‌ها</option></select>
      </div>
      <div id="productList"></div>
    </div>
  `;

  mainArea.appendChild(c);

  const locSel = c.querySelector("#productLocationFilter");
  locSel.innerHTML =
    '<option value="">همه موقعیت‌ها</option>' +
    DB.data.locations
      .map((l) => `<option value="${l.id}">${l.name}</option>`)
      .join("");

  c.querySelector("#addProduct").onclick = () => showProductForm();
  c.querySelector("#productSearch").oninput = () => drawProductList();
  c.querySelector("#productLocationFilter").onchange = () => drawProductList();

  // ارجاع به المان‌های نمایش آمار
  const totalPurchaseDisplay = document.getElementById("totalPurchaseDisplay");
  const totalSaleDisplay = document.getElementById("totalSaleDisplay");

  drawProductList();

  function drawProductList() {
    const q = c.querySelector("#productSearch").value.trim().toLowerCase();
    const loc = c.querySelector("#productLocationFilter").value;
    const container = c.querySelector("#productList");

    const filteredProducts = DB.data.products.filter((p) => {
      if (q) {
        if (
          !(
            p.name.toLowerCase().includes(q) ||
            (p.sku || "").toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q)
          )
        )
          return false;
      }
      if (loc && p.locationId !== loc) return false;
      return true;
    });
    // محاسبه خرید کل و فروش کل از مجموع سریال‌های موجود همه محصولات (برای نمایش در بالای صفحه)
    let totalPurchaseAll = 0;
    let totalSaleAll = 0;
    for (const p of filteredProducts) {
      const { totalPurchase, totalSale } = getTotalPricesFromSerials(p.id);
      totalPurchaseAll += totalPurchase;
      totalSaleAll += totalSale;
    }
    // به‌روزرسانی المان‌های بالای صفحه
    const totalPurchaseDisplay = document.getElementById(
      "totalPurchaseDisplay",
    );
    const totalSaleDisplay = document.getElementById("totalSaleDisplay");
    if (totalPurchaseDisplay)
      totalPurchaseDisplay.textContent = totalPurchaseAll.toFixed(2);
    if (totalSaleDisplay)
      totalSaleDisplay.textContent = totalSaleAll.toFixed(2);

    const rowsHtml = filteredProducts
      .map((p) => {
        const stock = getStockForProduct(p.id);
        const locName =
          DB.data.locations.find((x) => x.id === p.locationId)?.name || "-";
        // محاسبه مجموع قیمت سریال‌های موجود
        const { totalPurchase, totalSale } = getTotalPricesFromSerials(p.id);
        const purchasePriceDisplay =
          totalPurchase > 0 ? totalPurchase.toFixed(2) : "-";
        const salePriceDisplay = totalSale > 0 ? totalSale.toFixed(2) : "-";
        const imageHtml = p.image
          ? `<img src="${p.image}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="showLargeImage('${p.image.replace(/'/g, "\\'")}')">`
          : '<div style="width:50px; height:50px; background:#f0f0f0; border-radius:4px;"></div>';

        // فقط ادمین می‌تواند دکمه حذف را ببیند
        const showDelete = currentUserRole === "admin";

        return `
      <div class="product-row" data-product-id="${p.id}" style="display:flex; align-items:center;flex-wrap: wrap;gap:1rem; justify-content:center; padding:8px; border-bottom:1px solid #f5f6f8">
        <div style="display:flex; align-items:center; gap:10px; flex:2;">
          ${imageHtml}
          <div>
            <div><strong>${escapeHtml(p.name)}</strong> <span class="muted">(${escapeHtml(p.sku || "-")})</span></div>
            <div class="muted small">دسته: ${escapeHtml(p.category || "-")} — موقعیت: ${escapeHtml(locName)}</div>
 <div class="price-info muted small" style="color:#0b5e8a;">
          💰 خرید: ${purchasePriceDisplay} $ — 💵 فروش: ${salePriceDisplay} $
        </div>
          </div>
        </div>
        <div style="text-align:center; min-width:70px;">
          <div style="font-weight:600">${stock}</div>
          <div class="muted small">موجودی</div>
        </div>
        <div class="btnBox" style="display:flex; gap:6px;">
          <button class="btn ghost small" data-id="${p.id}" data-action="receive">ورود</button>
          <button class="btn ghost small" data-id="${p.id}" data-action="ship">خروج</button>
          <button class="btn small" data-id="${p.id}" data-action="edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
</svg>
</button>
          <button class="btn small manage-serials-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
</svg>
 $</button>
          ${
            showDelete
              ? `<button class="btn small danger" data-id="${p.id}" data-action="delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>`
              : ""
          }
          <button class="btn small print-qr-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M3 4.875C3 3.839 3.84 3 4.875 3h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5A1.875 1.875 0 0 1 3 9.375v-4.5ZM4.875 4.5a.375.375 0 0 0-.375.375v4.5c0 .207.168.375.375.375h4.5a.375.375 0 0 0 .375-.375v-4.5a.375.375 0 0 0-.375-.375h-4.5Zm7.875.375c0-1.036.84-1.875 1.875-1.875h4.5C20.16 3 21 3.84 21 4.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 0 1-1.875-1.875v-4.5Zm1.875-.375a.375.375 0 0 0-.375.375v4.5c0 .207.168.375.375.375h4.5a.375.375 0 0 0 .375-.375v-4.5a.375.375 0 0 0-.375-.375h-4.5ZM6 6.75A.75.75 0 0 1 6.75 6h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75A.75.75 0 0 1 6 7.5v-.75Zm9.75 0A.75.75 0 0 1 16.5 6h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75ZM3 14.625c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.035-.84 1.875-1.875 1.875h-4.5A1.875 1.875 0 0 1 3 19.125v-4.5Zm1.875-.375a.375.375 0 0 0-.375.375v4.5c0 .207.168.375.375.375h4.5a.375.375 0 0 0 .375-.375v-4.5a.375.375 0 0 0-.375-.375h-4.5Zm7.875-.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Zm6 0a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75ZM6 16.5a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Zm9.75 0a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Zm-3 3a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Zm6 0a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Z" clip-rule="evenodd" />
</svg>
</button>

        </div>
      </div>
    `;
      })
      .join("");

    container.innerHTML =
      rowsHtml ||
      '<div class="muted" style="padding:12px">موردی یافت نشد</div>';

    // بعد از container.innerHTML و قبل از بسته شدن drawProductList
    container.querySelectorAll(".manage-serials-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const productId = btn.getAttribute("data-id");
        const productName = btn.getAttribute("data-name");
        await showSerialManagementModal(productId, productName);
      });
    });
    // بارگذاری سریال‌ها برای هر ردیف
    container.querySelectorAll(".product-row").forEach((row) => {
      const productId = row.getAttribute("data-product-id");
      if (productId) {
        attachSerialsSummary(row, productId);
      }
    });

    // رویداد دکمه‌های اصلی (ورود، خروج، ویرایش)
    container.querySelectorAll("button").forEach((b) => {
      const action = b.getAttribute("data-action");
      if (action) {
        b.onclick = () => {
          const id = b.getAttribute("data-id");
          if (action === "receive") showTransactionForm(id, "in");
          if (action === "ship") showTransactionForm(id, "out");
          if (action === "edit") showProductForm(id);
        };
      }
    });
    // بعد از container.innerHTML و قبل از attachSerialsSummary یا در همان جایی که سایر رویدادها را می‌بندید
    container
      .querySelectorAll('button[data-action="delete"]')
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const productId = btn.getAttribute("data-id");
          if (
            !confirm(
              "آیا از حذف این کالا اطمینان دارید؟ این عمل برگشت‌ناپذیر است.",
            )
          )
            return;
          try {
            await DB.deleteProduct(productId);
            await DB.load(); // بارگذاری مجدد داده‌ها
            drawProductList(); // رفرش لیست اجناس
          } catch (err) {
            console.error(err);
            alert("خطا در حذف کالا: " + err.message);
          }
        });
      });
    // رویداد دکمه چاپ QR (که data-action ندارد)
    container.querySelectorAll(".print-qr-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const productId = btn.getAttribute("data-id");
        const productName = btn.getAttribute("data-name");
        await showProductSerialsModal(productId, productName);
      });
    });
  }
}

async function openReceiptWindow(invoice, items, customer) {
  try {
    if (!invoice) {
      console.error("openReceiptWindow: invoice is undefined or null", invoice);
      alert("خطا: اطلاعات فاکتور موجود نیست.");
      return;
    }

    items = Array.isArray(items) ? items : [];

    const safeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const resolveLocationName = (it) => {
      try {
        if (
          window &&
          window.DB &&
          window.DB.data &&
          Array.isArray(window.DB.data.products)
        ) {
          const pid =
            it.product_id || it.productId || it.product || it.productId;
          if (pid) {
            const prod = window.DB.data.products.find((p) => p.id === pid);
            if (prod) {
              const locId =
                prod.locationId || prod.location_id || prod.location;
              if (locId && Array.isArray(window.DB.data.locations)) {
                const loc = window.DB.data.locations.find(
                  (l) => l.id === locId,
                );
                if (loc && loc.name) return loc.name;
              }
              if (prod.locationName || prod.location_name)
                return prod.locationName || prod.location_name;
            }
          }
        }
      } catch (err) {
        // ignore
      }
      if (it.location_name || it.locationName || it.location)
        return it.location_name || it.locationName || it.location;
      return "-";
    };

    // تابع گروه‌بندی سریال‌ها
    const groupSerials = (serials) => {
      if (!Array.isArray(serials) || serials.length === 0) return [];
      const countMap = {};
      serials.forEach((s) => {
        countMap[s] = (countMap[s] || 0) + 1;
      });
      return Object.entries(countMap).map(([serial, count]) => ({
        serial,
        count,
      }));
    };

    const decoratedItems = items.map((it) => {
      const qty = safeNum(it.qty || it.quantity || it.count);
      const unit = safeNum(it.unit_price || it.unitPrice || it.price);
      const line = safeNum(it.line_total ?? it.lineTotal) || qty * unit;
      const locationName = resolveLocationName(it);
      let serials = [];
      if (Array.isArray(it.serials) && it.serials.length)
        serials = it.serials.map(String);
      else if (Array.isArray(it.serial_numbers) && it.serial_numbers.length)
        serials = it.serial_numbers.map(String);
      else if (it.serial && ("" + it.serial).trim())
        serials = [String(it.serial)];
      const groupedSerials = groupSerials(serials);
      return {
        ...it,
        qty,
        unit_price: unit,
        line_total: line,
        locationName,
        serials,
        groupedSerials,
      };
    });

    const computeSubtotal = (itemsList) => {
      if (!itemsList || !itemsList.length) return 0;
      return itemsList.reduce((s, it) => s + safeNum(it.line_total), 0);
    };

    const subtotal =
      safeNum(invoice.subtotal) || computeSubtotal(decoratedItems);
    const discount = safeNum(invoice.discount);
    const tax = safeNum(invoice.tax);
    const total = safeNum(invoice.total) || subtotal - discount + tax;

    const paidAmount = safeNum(invoice.paid_amount || 0);
    const remaining = total - paidAmount;
    const remainingLabel =
      invoice.remaining_action === "debt" ? "بدهی" : "تخفیف";

    const w = window.open("", "_blank");
    if (!w) {
      alert(
        "باز شدن پنجرهٔ رسید مسدود شد (popup blocked). اجازهٔ باز شدن پنجره را در مرورگر فعال کنید.",
      );
      return;
    }

    const escapeHtml = (str) =>
      String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // ساخت ردیف‌های جدول با گروه‌بندی سریال‌ها
    const rowsHtml = decoratedItems.length
      ? decoratedItems
          .map((it, i) => {
            const name =
              it.product_name ||
              it.product ||
              it.product_id ||
              it.productName ||
              "-";
            const sku =
              it.product_sku || it.sku || it.productSku || it.sku_code || "-";

            let serialsHtml = "";
            if (it.groupedSerials && it.groupedSerials.length) {
              serialsHtml =
                '<div style="font-size:11px; color:#6b7280; margin-top:4px;">';
              it.groupedSerials.forEach((g) => {
                serialsHtml += `<div>${escapeHtml(g.serial)} (${g.count} عدد)</div>`;
              });
              serialsHtml += "</div>";
            } else {
              serialsHtml = `<div style="font-size:11px; color:#6b7280; margin-top:4px;">—</div>`;
            }

            const productCellHtml = `<div style="text-align:left; padding-left:12px;"><strong>${escapeHtml(name)}</strong> <span class="muted">(${escapeHtml(sku || "-")})</span>${serialsHtml}</div>`;

            return `            <tr>
              <td>${i + 1}</td>
              <td class="text-right" style="padding-right:12px">${productCellHtml}</td>
              <td>${escapeHtml(it.locationName)}</td>
              <td>${it.qty}</td>
              <td>${Number(it.unit_price).toFixed(2)}</td>
              <td>${Number(it.line_total).toFixed(2)}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" style="padding:18px;color:#6b7280">هیچ آیتمی وجود ندارد</td></tr>`;

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>رسید ${escapeHtml(invoice.id || "")}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{--bg:#f6f8fb;--card:#ffffff;--muted:#6b7280;--accent:#0b74de;--accent-2:#06a77d;--border:#e6e9ef;--radius:12px;--shadow:0 6px 18px rgba(12,20,40,0.06);--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;}
    html,body{height:100%;margin:0;background:var(--bg);font-family:var(--font-sans);color:#111;direction:rtl}
    .wrap{max-width:900px;margin:20px auto;padding:20px}
    .receipt-card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;border:1px solid var(--border)}
    .head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);gap:12px}
    .brand{display:flex;gap:12px;align-items:center}
    .logo{width:68px;height:68px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;font-weight:700;font-size:18px}
    .company h1{margin:0;font-size:18px}
    .company p{margin:2px 0 0;font-size:13px;color:var(--muted)}
    .meta{ text-align:left; font-size:13px; color:var(--muted)}
    /* ===== تغییر اصلی: حذف grid و قرار دادن بخش‌ها به صورت عمودی ===== */
    .items{background:linear-gradient(180deg,#fff,#fbfdff);padding:8px;border-radius:10px;border:1px solid var(--border);overflow:auto; margin-bottom:20px;}
    .summary{background:#fff;padding:14px;border-radius:10px;border:1px solid var(--border); width:100%; box-sizing:border-box;}
    table{width:100%;border-collapse:collapse;font-size:14px}
    thead th{background:#fbfcff;padding:10px;text-align:center;border-bottom:1px solid var(--border);font-weight:600;color:#222}
    tbody td{padding:10px;text-align:center;border-bottom:1px dashed var(--border)}
    .text-right{text-align:right}
    .summary .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--bg)}
    .summary .row.total{font-weight:800;font-size:18px;border-top:1px solid var(--border);padding-top:12px;margin-top:8px}
    .notes{margin-top:10px;color:var(--muted);font-size:13px}
    .payment-info{background:#f0f9ff;border-radius:8px;padding:12px;margin-top:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;}
    .footer{padding:18px 24px;border-top:1px solid var(--border);background:linear-gradient(180deg,#fff,#fbfbff);display:flex;justify-content:space-between;align-items:center;gap:12px}
    .store-info{font-size:13px;color:var(--muted);line-height:1.4}
    .qr{width:84px;height:84px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#f3f6fb;border:1px solid var(--border)}
    .serial-list{font-size:12px;color:#6b7280;margin-top:6px;word-break:break-word}
    .serial-copy{cursor:pointer;color:#0b74de;text-decoration:underline;margin-left:8px;font-size:12px}
    /* تنظیمات چاپ پرتره A4 */
    @media print {
      body { background: #fff; }
      .wrap { max-width: 100%; margin: 0; padding: 0.5cm; }
      .receipt-card { box-shadow: none; border: 1px solid #ddd; }
      @page { size: A4 portrait; margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="wrap" role="document">
    <div class="receipt-card">
      <div class="head">
        <div class="brand">
          <div class="logo">دفاری</div>
          <div class="company">
            <h1>${escapeHtml(invoice.store_name || "شرکت تجارتی دفاری لمیتد")}</h1>
            <p>${escapeHtml(invoice.store_tagline || "")}</p>
          </div>
        </div>
        <div class="meta invice_top" aria-label="Receipt meta">
          <div>نمبر بل: <strong>${escapeHtml(invoice.id || "-")}</strong></div>
          <div>تاریخ: <strong>${escapeHtml(invoice.date ? invoice.date.split("T")[0] : "-")}</strong></div>
          <div>پرسونل: <strong>${escapeHtml(invoice.seller_name || "مدیر فروشات")}</strong></div>
        </div>
      </div>

      <!-- جدول آیتم‌ها -->
      <div class="items">
        <table aria-label="Items">
          <thead>
            <tr>
              <th style="width:48px">شماره</th>
              <th style="text-align:left;padding-left:12px">تفصیلات</th>
              <th style="width:120px">موقعیت</th>
              <th style="width:90px">تعداد</th>
              <th style="width:120px">قیمت واحد</th>
              <th style="width:120px">جمله</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="notes">
          <div><strong>مشتری:</strong> ${escapeHtml(customer ? customer.name || "-" : "-")}</div>
          ${invoice.note ? `<div style="margin-top:6px"><strong>توضیح:</strong> ${escapeHtml(invoice.note)}</div>` : ""}
        </div>
      </div>

      <!-- بخش خلاصه (اکنون در پایین) -->
      <div class="summary" aria-label="Summary">
        <div style="margin-bottom:6px;font-size:13px;color:#6b7280">خلاصهٔ</div>
        <div class="row"><div>جمله جزئیات</div><div>${subtotal.toFixed(2)} $</div></div>
        <div class="row" style="display:none"><div>تخفیف</div><div>${discount.toFixed(2)} $</div></div>
        <div class="row" style="display:none"><div>مالیات</div><div>${tax.toFixed(2)} $</div></div>
        <div class="row total"><div>جمله کل</div><div>${total.toFixed(2)} $</div></div>
        
        <!-- بخش پرداخت -->
        <div class="payment-info">
          <div><strong>مبلغ پرداختی:</strong> ${paidAmount.toFixed(2)} $</div>
          <div><strong>باقی‌مانده:</strong> ${remaining.toFixed(2)} $ (${remainingLabel})</div>
        </div>
        
        <div class="notes" style="margin-top:12px">
          <div>نحوه پرداخت: <strong>${escapeHtml(invoice.payment_method || "نقد / کارت")}</strong></div>
          <div style="margin-top:6px">کد رسید: <strong>${escapeHtml(invoice.reference || "-")}</strong></div>
        </div>
      </div>

      <div class="footer">
        <div class="store-info">
          <div><strong>آدرس:</strong> ${escapeHtml(invoice.store_address || "—")}</div>
          <div><strong>تلفن:</strong> ${escapeHtml(invoice.store_phone || "—")}</div>
          <div><strong>وب‌سایت / ایمیل:</strong> ${escapeHtml(invoice.store_www || "—")}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
          <div class="qr" aria-hidden="true">QR</div>
          <div style="font-size:12px;color:#6b7280">از خرید شما متشکریم!</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      function copyText(text) {
        if (!text) return;
        try {
          navigator.clipboard.writeText(text);
        } catch(e) {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
      }
      document.addEventListener('click', function(ev) {
        const t = ev.target;
        if (t && t.classList && t.classList.contains('serial-copy')) {
          const targetId = t.getAttribute('data-target');
          const el = document.getElementById(targetId);
          if (el) copyText(el.innerText);
          t.innerText = 'کپی شد';
          setTimeout(() => t.innerText = 'کپی', 1200);
        }
      });
    })();
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();

    // بخش واکشی سریال‌ها برای تکمیل اطلاعات (در صورت نیاز) – بدون تغییر
    try {
      const fetchPromises = decoratedItems.map(async (it, idx) => {
        if (it.serials && it.serials.length) return null;
        const productId = it.productId || it.product_id || it.product;
        if (!productId) return null;

        let txRows = [];
        try {
          const txResp = await fetch(
            "/api/transactions?productId=" +
              encodeURIComponent(productId) +
              "&limit=500",
          );
          if (txResp.ok) txRows = await txResp.json();
        } catch (e) {
          console.warn(
            "failed fetching transactions for product",
            productId,
            e,
          );
        }

        const invoiceId = String(invoice.id || "");
        const matchedTxIds = new Set();
        for (const t of txRows || []) {
          if (t.note && String(t.note).includes(invoiceId))
            matchedTxIds.add(t.id);
        }

        try {
          const serResp = await fetch(
            "/api/products/" + encodeURIComponent(productId) + "/serials",
          );
          if (!serResp.ok) return { idx, serials: [] };
          const serRows = await serResp.json();
          let filtered = [];
          if (matchedTxIds.size > 0) {
            filtered = (serRows || [])
              .filter(
                (r) => r.transaction_id && matchedTxIds.has(r.transaction_id),
              )
              .map((r) => r.serial);
          }
          if ((!filtered || filtered.length === 0) && Array.isArray(serRows)) {
            const invTime = invoice.date
              ? new Date(invoice.date).getTime()
              : null;
            filtered = (serRows || [])
              .filter((r) => {
                const sStat = (r.status || "").toString().toLowerCase();
                if (sStat === "sold") return true;
                if (invTime && r.date) {
                  const d = new Date(r.date).getTime();
                  return Math.abs(d - invTime) <= 2 * 24 * 60 * 60 * 1000;
                }
                return false;
              })
              .map((r) => r.serial);
          }
          return { idx, serials: filtered || [] };
        } catch (e) {
          console.warn("failed fetching serials for product", productId, e);
          return { idx, serials: [] };
        }
      });

      const fetchResults = await Promise.all(fetchPromises);

      for (const resItem of fetchResults) {
        if (!resItem) continue;
        const { idx, serials } = resItem;
        const el = w.document.getElementById("serials_" + idx);
        if (!el) continue;
        if (serials && serials.length) {
          el.innerHTML =
            '<span class="serial-list" id="serials_text_' +
            idx +
            '">' +
            escapeHtml(serials.join(", ")) +
            "</span>" +
            '<span class="serial-copy" data-target="serials_text_' +
            idx +
            '">کپی</span>';
        } else {
          el.innerHTML = "—";
        }
      }
    } catch (errFetch) {
      console.warn(
        "openReceiptWindow: error fetching serials to enrich receipt",
        errFetch,
      );
    }
  } catch (err) {
    console.error("openReceiptWindow error:", err);
    alert("خطا در ساخت رسید — نگاه کن console برای جزئیات.");
  }
}

// ==================== تابع اصلاح‌شده showInvoiceForm ====================
async function showInvoiceFormWithPreset(
  productId,
  serial,
  presetPrice = null,
) {
  const product = DB.data.products.find((p) => p.id === productId);
  if (!product) {
    alert("کالا یافت نشد");
    return;
  }
  const unitPrice =
    presetPrice !== null && presetPrice !== "نامشخص"
      ? presetPrice
      : product.defaultSalePrice || 0;
  window.presetInvoiceItem = {
    productId: productId,
    qty: 1,
    unit_price: unitPrice,
    serials: [serial],
  };
  await showInvoiceForm();
}
async function showInvoiceForm() {
  // اضافه کردن چند سریال به یک ردیف (گروه‌بندی شده)
  // اضافه کردن چند سریال به صورت یک ردیف جدید (بدون ادغام با ردیف‌های موجود)
  function addSerialsToInvoice(productId, serialsArray, salePrice) {
    if (!serialsArray.length) return;
    // همیشه یک ردیف جدید بساز (حتی اگر محصول تکراری باشد)
    addRow({
      productId: productId,
      qty: serialsArray.length,
      unit_price: salePrice,
      serials: serialsArray,
    });
  }
  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";

  const productOptions =
    '<option value="">— انتخاب کالا —</option>' +
    DB.data.products
      .map(
        (p) => `<option value="${p.id}">${p.name} (${p.sku || "-"})</option>`,
      )
      .join("");
  const customerOptions = DB.data.customers
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  card.innerHTML = `
    <h3>بل جدید</h3>
    <form id="invForm">
      <label>مشتری (اختیاری)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <select name="customerId" style="flex:1"><option value="">—</option>${customerOptions}</select>
        <button type="button" id="addCustomerBtn" class="btn small">+ مشتری جدید</button>
      </div>
      <div id="itemsWrap" style="margin-top:8px"></div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button type="button" id="addInvItem" class="btn small">افزودن ردیف</button>
        <button type="button" id="scanSerialBtn" class="btn small" ><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
</svg>
 اسکن QR</button>
      </div>
      <div style="margin-top:12px;">
        <strong>جمع کل: <span id="invoice_total_display">0.00</span> $</strong>
      </div>
      <div style="margin-top:12px; border-top:1px solid #eee; padding-top:12px;">
        <label>مبلغ پرداختی مشتری ($)</label>
        <input type="number" name="paidAmount" step="0.01" value="0" style="width:200px;">
        <label>باقی‌مانده چگونه محاسبه شود؟</label>
        <select name="remainingAction" style="width:200px;">
          <option value="discount">به عنوان تخفیف</option>
          <option value="debt">به عنوان بدهی</option>
        </select>
        <small class="muted" style="display:block; margin-top:4px;">مجموع کل بر اساس آیتم‌ها محاسبه می‌شود. مبلغ پرداختی از آن کم می‌شود و باقی‌مانده با انتخاب شما ثبت می‌گردد.</small>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" type="submit">ثبت بل</button>
        <button class="btn ghost" id="cancelInv" type="button">انصراف</button>
      </div>
    </form>
  `;
  mainArea.prepend(card);
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  card.querySelector("#cancelInv").onclick = () => card.remove();
  card.querySelector("#addCustomerBtn").onclick = async () => {
    const name = prompt("نام مشتری را وارد کنید:");
    if (!name) return;
    try {
      const created = await DB.createCustomer({
        name: name.trim(),
        contact: "",
      });
      const sel = card.querySelector('select[name="customerId"]');
      const opt = document.createElement("option");
      opt.value = created.id;
      opt.text = created.name;
      sel.appendChild(opt);
      sel.value = created.id;
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد مشتری");
    }
  };

  window.rows = [];
  window.selectedSerialsByRow = {};
  let scannerModal = null;
  let html5QrCode = null;
  let isScanning = false;

  function updateTotalSum() {
    let total = 0;
    document
      .querySelectorAll("#itemsWrap .line_total_display")
      .forEach((span) => {
        total += Number(span.textContent) || 0;
      });
    const totalDisplay = card.querySelector("#invoice_total_display");
    if (totalDisplay) totalDisplay.textContent = total.toFixed(2);
  }

  function addRow(item = {}) {
    const wrap = card.querySelector("#itemsWrap");
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginTop = "6px";
    row.style.alignItems = "center";
    row.style.flexWrap = "wrap";

    const newRowData = {
      productId: item.productId || "",
      qty: Number(item.qty || 1),
      unit_price: Number(item.unit_price || 0),
    };
    window.rows.push(newRowData);
    const rowIndex = window.rows.length - 1;
    row.dataset.rowIndex = rowIndex;
    row.id = `row-${rowIndex}`;

    row.innerHTML = `
      <select name="productId" style="flex:2; min-width:150px;">${productOptions}</select>
      <input name="qty" type="number" value="${item.qty || 1}" style="width:70px">
      <input name="unit_price" type="number" value="${item.unit_price || 0}" style="width:100px">
      <span class="line_total_display" style="width:80px; text-align:center; font-weight:600;">0.00</span>
      <div class="serialCell" style="display:flex;align-items:center;gap:4px;"></div>
      <button type="button" class="btn ghost small remove">حذف</button>
    `;

    const sel = row.querySelector('select[name="productId"]');
    const qtyInput = row.querySelector('input[name="qty"]');
    const priceInput = row.querySelector('input[name="unit_price"]');
    const lineTotalSpan = row.querySelector(".line_total_display");
    const removeBtn = row.querySelector(".remove");
    const serialCell = row.querySelector(".serialCell");

    if (item.productId) {
      sel.value = item.productId;
      window.rows[rowIndex].productId = item.productId;
    } else {
      sel.value = ""; // گزینه خالی را انتخاب کن
      // توجه: window.rows[rowIndex].productId نباید مقداردهی شود؛ قبلاً در newRowData خالی است
    }

    function updateLineTotal() {
      const qty = Number(qtyInput.value) || 0;
      const price = Number(priceInput.value) || 0;
      const lineTotal = qty * price;
      lineTotalSpan.textContent = lineTotal.toFixed(2);
      updateTotalSum();
    }

    const serialBtn = document.createElement("button");
    serialBtn.type = "button";
    serialBtn.className = "btn small";
    serialBtn.textContent = "انتخاب سریال";
    serialCell.appendChild(serialBtn);

    function updateSerialButtonText() {
      const idx = parseInt(row.dataset.rowIndex);
      const selected = window.selectedSerialsByRow[idx] || [];
      const qty = Number(qtyInput.value) || 0;
      serialBtn.textContent = selected.length
        ? `سریال (${selected.length}/${qty})`
        : "انتخاب سریال";
    }

    serialBtn.onclick = async () => {
      const idx = parseInt(row.dataset.rowIndex);
      const pid = sel.value;
      if (!pid) {
        alert("ابتدا یک کالا انتخاب کنید.");
        return;
      }
      const qty = Number(qtyInput.value || 1);
      showSerialSelector(pid, qty, async (selectedSerials) => {
        const prices = [];
        for (const s of selectedSerials) {
          try {
            const resp = await fetch(
              `${API_BASE}/serials/${encodeURIComponent(s)}/price`,
            );
            if (!resp.ok) throw new Error(`قیمت سریال ${s} یافت نشد`);
            const data = await resp.json();
            if (data.sale_price === null || data.sale_price === undefined) {
              throw new Error(`سریال ${s} قیمت فروش ندارد`);
            }
            prices.push(Number(data.sale_price));
          } catch (err) {
            alert(err.message);
            return;
          }
        }
        const uniquePrices = [...new Set(prices)];
        if (uniquePrices.length > 1) {
          alert(
            `سریال‌های انتخاب شده قیمت فروش متفاوتی دارند: ${uniquePrices.join(", ")}`,
          );
          return;
        }
        const unitPrice = uniquePrices[0];
        priceInput.value = unitPrice;
        window.rows[idx].unit_price = unitPrice;
        window.selectedSerialsByRow[idx] = selectedSerials;
        window.rows[idx].serials = selectedSerials;
        updateSerialButtonText();
        updateLineTotal();
      });
    };

    sel.addEventListener("change", () => {
      const idx = parseInt(row.dataset.rowIndex);
      const pid = sel.value;
      const prod = DB.data.products.find((p) => p.id === pid);
      window.rows[idx].productId = pid;
      delete window.selectedSerialsByRow[idx];
      delete window.rows[idx].serials;
      updateSerialButtonText();
      if (prod && prod.defaultSalePrice != null) {
        priceInput.value = prod.defaultSalePrice;
        window.rows[idx].unit_price = prod.defaultSalePrice;
      }
      updateLineTotal();
    });

    qtyInput.addEventListener("input", () => {
      const idx = parseInt(row.dataset.rowIndex);
      const v = Number(qtyInput.value) || 0;
      window.rows[idx].qty = v;
      const selected = window.selectedSerialsByRow[idx] || [];
      if (selected.length > 0 && selected.length > v) {
        delete window.selectedSerialsByRow[idx];
        delete window.rows[idx].serials;
      }
      updateSerialButtonText();
      updateLineTotal();
    });

    priceInput.addEventListener("input", () => {
      const idx = parseInt(row.dataset.rowIndex);
      window.rows[idx].unit_price = Number(priceInput.value) || 0;
      updateLineTotal();
    });

    removeBtn.onclick = () => {
      const idx = parseInt(row.dataset.rowIndex);
      delete window.selectedSerialsByRow[idx];
      window.rows.splice(idx, 1);
      row.remove();
      reindexAllRows();
      updateTotalSum();
    };

    if (sel.value) {
      const prod = DB.data.products.find((p) => p.id === sel.value);
      if (prod && prod.defaultSalePrice != null) {
        priceInput.value = prod.defaultSalePrice;
        window.rows[rowIndex].unit_price = prod.defaultSalePrice;
      }
    }

    if (item.serials && item.serials.length) {
      window.selectedSerialsByRow[rowIndex] = item.serials;
      window.rows[rowIndex].serials = item.serials;
      updateSerialButtonText();
    }

    wrap.appendChild(row);
    updateLineTotal();
  }

  function reindexAllRows() {
    const wrap = card.querySelector("#itemsWrap");
    const children = Array.from(wrap.children);
    const newSelected = {};
    const newRows = [];
    children.forEach((ch, newIdx) => {
      ch.dataset.rowIndex = newIdx;
      ch.id = `row-${newIdx}`;
      const prodSel = ch.querySelector('select[name="productId"]');
      const qtyInput = ch.querySelector('input[name="qty"]');
      const priceInput = ch.querySelector('input[name="unit_price"]');
      const prodId = prodSel ? prodSel.value : "";
      const qty = qtyInput ? Number(qtyInput.value) || 0 : 0;
      const unit_price = priceInput ? Number(priceInput.value) || 0 : 0;
      newRows.push({ productId: prodId, qty, unit_price });
    });
    const oldSelected = window.selectedSerialsByRow || {};
    Object.keys(oldSelected).forEach((oldIdxStr) => {
      const oldIdx = parseInt(oldIdxStr);
      const oldProd = window.rows[oldIdx]?.productId;
      if (!oldProd) return;
      for (let ni = 0; ni < newRows.length; ni++) {
        if (newRows[ni].productId === oldProd && !newSelected[ni]) {
          newSelected[ni] = oldSelected[oldIdx];
          break;
        }
      }
    });
    window.rows = newRows;
    window.selectedSerialsByRow = newSelected;
    children.forEach((ch, idx) => {
      const btn = ch.querySelector(".serialCell button");
      if (btn) {
        const selected = newSelected[idx] || [];
        const qty = Number(ch.querySelector('input[name="qty"]').value) || 0;
        btn.textContent = `سریال (${selected.length}/${qty})`;
      }
    });
  }

  // ========== اسکنر QR برای اضافه کردن سریال به فرم ==========
  async function startScannerForInvoice() {
    if (scannerModal) {
      scannerModal.style.display = "flex";
      return;
    }
    scannerModal = document.createElement("div");
    scannerModal.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: rgba(0,0,0,0.9); z-index: 10020;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  `;
    scannerModal.innerHTML = `
    <div style="background: #fff; border-radius: 20px; width: 90%; max-width: 500px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <h3 id="scannerTitle">اسکن سریال</h3>
        <button id="closeScannerModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      <div id="qr-reader-invoice" style="width: 100%;"></div>
      <div id="scanStatus" style="margin-top: 10px; text-align: center; font-size: 14px;"></div>
      <!-- بخش ورود تعداد و افزودن (در ابتدا مخفی) -->
      <div id="scannerQuantityPanel" style="display:none; margin-top:16px; padding-top:12px; border-top:1px solid #eee;">
        <label>تعداد (حداکثر <span id="maxCountLabel">0</span> عدد موجود):</label>
        <input type="number" id="scannerQuantity" value="1" min="1" step="1" style="width:100%; margin-top:6px;">
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button id="addScannedItemBtn" class="btn" style="flex:1;">➕ افزودن به بل</button>
          <button id="cancelScanAddBtn" class="btn ghost" style="flex:1;">انصراف</button>
        </div>
      </div>
    </div>
  `;
    document.body.appendChild(scannerModal);

    const closeBtn = scannerModal.querySelector("#closeScannerModalBtn");
    const statusDiv = scannerModal.querySelector("#scanStatus");
    const quantityPanel = scannerModal.querySelector("#scannerQuantityPanel");
    const quantityInput = scannerModal.querySelector("#scannerQuantity");
    const maxCountLabel = scannerModal.querySelector("#maxCountLabel");
    const addBtn = scannerModal.querySelector("#addScannedItemBtn");
    const cancelAddBtn = scannerModal.querySelector("#cancelScanAddBtn");
    let lastScannedGroup = null; // { productId, productName, serialValue, availableCount, salePrice, serials }

    function closeScanner() {
      if (html5QrCode && isScanning) {
        html5QrCode.stop().catch((e) => console.warn(e));
        isScanning = false;
      }
      if (scannerModal) scannerModal.remove();
      scannerModal = null;
      lastScannedGroup = null;
    }

    closeBtn.onclick = () => closeScanner();
    scannerModal.onclick = (e) => {
      if (e.target === scannerModal) closeScanner();
    };

    // افزودن تعداد انتخاب شده به بل
    async function addScannedItemToInvoice() {
      if (!lastScannedGroup) return;
      let qty = parseInt(quantityInput.value, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      if (qty > lastScannedGroup.availableCount) {
        alert(`حداکثر تعداد موجود: ${lastScannedGroup.availableCount}`);
        return;
      }
      try {
        // دوباره اطلاعات به‌روز گروه را از سرور می‌گیریم
        const groupRes = await fetch(
          `${API_BASE}/serials/group/${encodeURIComponent(lastScannedGroup.serialValue)}`,
        );
        if (!groupRes.ok) throw new Error("خطا در دریافت اطلاعات سریال‌ها");
        const groupData = await groupRes.json();
        if (groupData.availableCount < qty) {
          alert(
            `تعداد سریال‌های موجود کاهش یافته است. فقط ${groupData.availableCount} عدد موجود است.`,
          );
          return;
        }
        const selectedSerials = groupData.serials
          .slice(0, qty)
          .map((s) => s.serial);
        // ✅ افزودن یکجا به ردیف
        addSerialsToInvoice(
          lastScannedGroup.productId,
          selectedSerials,
          lastScannedGroup.salePrice,
        );
        closeScanner();
      } catch (err) {
        alert("خطا: " + err.message);
        // در صورت خطا، اسکنر را دوباره فعال می‌کنیم
        html5QrCode.resume();
        isScanning = true;
        quantityPanel.style.display = "none";
      }
    }

    cancelAddBtn.onclick = () => {
      // پنل را مخفی کن و اسکن را از سر بگیر
      quantityPanel.style.display = "none";
      lastScannedGroup = null;
      statusDiv.innerHTML = "در حال انتظار برای اسکن مجدد...";
      if (html5QrCode && !isScanning) {
        html5QrCode.resume();
        isScanning = true;
      }
    };

    addBtn.onclick = () => addScannedItemToInvoice();

    // شروع دوربین
    try {
      html5QrCode = new Html5Qrcode("qr-reader-invoice");
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      const facingMode = isMobile ? "environment" : "user";
      await html5QrCode.start(
        { facingMode: facingMode },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // مکث اسکنر تا کاربر تعداد را انتخاب کند
          html5QrCode.pause();
          isScanning = false;
          statusDiv.innerHTML = `✅ اسکن شد: ${decodedText}<br>در حال بررسی...`;

          try {
            const groupRes = await fetch(
              `${API_BASE}/serials/group/${encodeURIComponent(decodedText)}`,
            );
            if (!groupRes.ok) {
              if (groupRes.status === 404) {
                statusDiv.innerHTML = `❌ هیچ سریال موجودی با مقدار "${decodedText}" یافت نشد.<br>اسکنر ادامه می‌دهد...`;
                html5QrCode.resume();
                isScanning = true;
              } else {
                throw new Error("خطا در دریافت اطلاعات گروه");
              }
              return;
            }
            const groupData = await groupRes.json();
            if (!groupData.salePrice) {
              statusDiv.innerHTML = `❌ برای کالا "${groupData.productName}" قیمت فروش تعریف نشده.<br>اسکنر ادامه می‌دهد...`;
              html5QrCode.resume();
              isScanning = true;
              return;
            }
            lastScannedGroup = {
              productId: groupData.productId,
              productName: groupData.productName,
              serialValue: groupData.serialValue,
              availableCount: groupData.availableCount,
              salePrice: groupData.salePrice,
              serials: groupData.serials,
            };
            statusDiv.innerHTML = `کالا: ${groupData.productName}<br>قیمت واحد: ${groupData.salePrice} $<br>موجودی: ${groupData.availableCount} عدد`;
            maxCountLabel.textContent = groupData.availableCount;
            quantityInput.value = 1;
            quantityInput.min = 1;
            quantityInput.max = groupData.availableCount;
            quantityPanel.style.display = "block";
          } catch (err) {
            statusDiv.innerHTML = `❌ خطا: ${err.message}<br>اسکنر ادامه می‌دهد...`;
            html5QrCode.resume();
            isScanning = true;
          }
        },
        (err) => {
          console.warn("Scan error", err);
        },
      );
      isScanning = true;
    } catch (err) {
      statusDiv.innerHTML = `⚠️ خطا در دسترسی به دوربین: ${err.message}`;
    }
  }

  // تابع اضافه کردن ردیف محصول با تعداد (بدون سریال – بعداً باید سریال انتخاب شود)
  function addProductRowWithQuantity(productId, qty, unitPrice) {
    // بررسی آیا ردیفی با همین محصول وجود دارد که هنوز سریال‌ها کامل نشده؟
    let targetRowIndex = -1;
    for (let i = 0; i < window.rows.length; i++) {
      const row = window.rows[i];
      if (row.productId === productId) {
        const currentSerials = window.selectedSerialsByRow[i] || [];
        if (currentSerials.length < row.qty) {
          targetRowIndex = i;
          break;
        }
      }
    }
    if (targetRowIndex !== -1) {
      // افزایش تعداد در ردیف موجود
      const existingRow = window.rows[targetRowIndex];
      existingRow.qty += qty;
      // قیمت واحد را میانگین نگیریم – همان قیمت اولیه را نگه دار
      // به‌روزرسانی نمایش
      const rowDiv = document.getElementById(`row-${targetRowIndex}`);
      if (rowDiv) {
        const qtyInput = rowDiv.querySelector('input[name="qty"]');
        if (qtyInput) qtyInput.value = existingRow.qty;
        const priceInput = rowDiv.querySelector('input[name="unit_price"]');
        if (priceInput && priceInput.value != unitPrice) {
          // اگر قیمت متفاوت است، می‌توانیم از قیمت جدید استفاده کنیم یا پیام دهیم
          // برای سادگی، همان قیمت قبلی را نگه می‌داریم
        }
        // به‌روزرسانی line_total
        const lineTotalSpan = rowDiv.querySelector(".line_total_display");
        if (lineTotalSpan) {
          const lineTotal = existingRow.qty * existingRow.unit_price;
          lineTotalSpan.textContent = lineTotal.toFixed(2);
        }
        const serialBtn = rowDiv.querySelector(".serialCell button");
        if (serialBtn) {
          const selected = window.selectedSerialsByRow[targetRowIndex] || [];
          serialBtn.textContent = `سریال (${selected.length}/${existingRow.qty})`;
        }
      }
      updateTotalSum();
    } else {
      // ایجاد ردیف جدید
      addRow({
        productId: productId,
        qty: qty,
        unit_price: unitPrice,
        serials: [], // بدون سریال – کاربر بعداً از دکمه انتخاب سریال پر می‌کند
      });
    }
  }

  function addSerialToInvoice(productId, serial, salePrice) {
    // بررسی آیا ردیفی با همین محصول وجود دارد که هنوز سریال‌های آن کامل نشده؟
    let targetRowIndex = -1;
    for (let i = 0; i < window.rows.length; i++) {
      const row = window.rows[i];
      if (row.productId === productId) {
        const currentSerials = window.selectedSerialsByRow[i] || [];
        if (currentSerials.length < row.qty) {
          targetRowIndex = i;
          break;
        }
      }
    }
    if (targetRowIndex !== -1) {
      // افزودن به ردیف موجود
      const existingSerials = window.selectedSerialsByRow[targetRowIndex] || [];
      existingSerials.push(serial);
      window.selectedSerialsByRow[targetRowIndex] = existingSerials;
      window.rows[targetRowIndex].serials = existingSerials;
      // به‌روزرسانی نمایش دکمه سریال
      const rowDiv = document.getElementById(`row-${targetRowIndex}`);
      if (rowDiv) {
        const serialBtn = rowDiv.querySelector(".serialCell button");
        if (serialBtn) {
          const qty = window.rows[targetRowIndex].qty;
          serialBtn.textContent = `سریال (${existingSerials.length}/${qty})`;
        }
      }
    } else {
      // ایجاد ردیف جدید
      addRow({
        productId: productId,
        qty: 1,
        unit_price: salePrice,
        serials: [serial],
      });
    }
    updateTotalSum();
  }

  card.querySelector("#addInvItem").onclick = () => addRow();
  card.querySelector("#scanSerialBtn").onclick = () => startScannerForInvoice();
  addRow();

  const presetItem = window.presetInvoiceItem;
  if (presetItem) {
    const wrap = card.querySelector("#itemsWrap");
    if (wrap.firstChild) wrap.firstChild.remove();
    window.rows = [];
    window.selectedSerialsByRow = {};
    addRow({
      productId: presetItem.productId,
      qty: presetItem.qty,
      unit_price: presetItem.unit_price,
      serials: presetItem.serials,
    });
    delete window.presetInvoiceItem;
  }

  card.querySelector("#invForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const customerId = f.customerId.value || null;
    const paidAmount = Number(f.paidAmount.value) || 0;
    const remainingAction = f.remainingAction.value;

    for (let i = 0; i < window.rows.length; i++) {
      const row = window.rows[i];
      if (!row.productId || row.qty <= 0) continue;
      const selected = window.selectedSerialsByRow[i] || [];
      if (selected.length !== row.qty) {
        const productName =
          DB.data.products.find((p) => p.id === row.productId)?.name ||
          row.productId;
        alert(
          `کالای «${productName}» نیاز به انتخاب دقیقاً ${row.qty} سریال دارد (${selected.length} سریال انتخاب شده).`,
        );
        return;
      }
    }

    const items = [];
    for (let i = 0; i < window.rows.length; i++) {
      const row = window.rows[i];
      if (!row.productId || row.qty <= 0) continue;
      items.push({
        productId: row.productId,
        qty: row.qty,
        unit_price: row.unit_price,
        serials: window.selectedSerialsByRow[i] || [],
      });
    }
    if (items.length === 0) {
      alert("حداقل یک آیتم معتبر لازم است");
      return;
    }

    try {
      const result = await DB.createInvoice({
        customerId,
        items,
        note: "فروش",
        paidAmount,
        remainingAction,
      });
      const itemsForReceipt = items.map((it) => {
        const prod = DB.data.products.find((p) => p.id === it.productId);
        return { ...it, product_name: prod ? prod.name : it.productId };
      });
      const customer =
        DB.data.customers.find((c) => c.id === customerId) || null;
      openReceiptWindow(result.invoice, itemsForReceipt, customer);
      card.remove();
      await DB.load();
      renderMain("invoices");
    } catch (err) {
      console.error(err);
      alert("خطا در ساخت بل");
    }
  };
}
async function showInvoiceFormWithPreset(
  productId,
  serial,
  presetPrice = null,
) {
  // ابتدا اطلاعات محصول را از دیتابیس محلی دریافت کنیم
  const product = DB.data.products.find((p) => p.id === productId);
  if (!product) {
    alert("کالا یافت نشد");
    return;
  }
  const unitPrice =
    presetPrice !== null ? presetPrice : product.defaultSalePrice || 0;
  // فراخوانی فرم اصلی showInvoiceForm و منتقل کردن آیتم پیش‌فرض
  // از آنجایی که showInvoiceForm به صورت async است و ممکن است مقادیر را از طریق یک پارامتر global دریافت کند،
  // بهتر است showInvoiceForm را طوری تغییر دهیم که بتواند یک آیتم اولیه را بپذیرد.
  // روش ساده: قبل از صدا زدن showInvoiceForm، یک متغیر سراسری presetInvoiceItem تنظیم کنیم
  window.presetInvoiceItem = {
    productId: productId,
    qty: 1,
    unit_price: unitPrice,
    serials: [serial],
  };
  await showInvoiceForm();
  // پس از بسته شدن فرم (یا قبل از آن) می‌توان preset را پاک کرد
  // توجه: showInvoiceForm باید داخل خودش preset را بررسی کند و ردیف اولیه را اضافه کند
}
function showDocumentsModal(docsJson) {
  let docs = [];
  try {
    docs = JSON.parse(docsJson);
  } catch (e) {
    docs = [docsJson];
  }
  if (!docs.length) return;

  const modalHtml = `
    <div id="docsModal" class="modal-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:10001;">
      <div style="background:#fff; border-radius:12px; max-width:90%; max-height:90%; overflow:auto; padding:16px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <h3>مدارک پرسونل</h3>
          <button id="closeDocsModal" style="background:none; border:none; font-size:20px; cursor:pointer;">✕</button>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          ${docs
            .map(
              (doc, idx) => `
            <div style="border:1px solid #ddd; border-radius:8px; padding:4px;">
              <a href="${doc}" target="_blank" rel="noopener noreferrer">
                <img src="${doc}" style="max-width:200px; max-height:200px; object-fit:contain;" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%3E%3Cpath%20d%3D%22M14%202H6a2%202%200%2000-2%202v16a2%202%200%20002%202h12a2%202%200%20002-2V8z%22%2F%3E%3Cpolyline%20points%3D%2214%202%2014%208%2020%208%22%2F%3E%3C%2Fsvg%3E'">
              </a>
              <div style="text-align:center; font-size:12px;">مدرک ${idx + 1}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("docsModal");
  modal.querySelector("#closeDocsModal").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ==================== ماژول معاشات پرسونل ====================
async function renderSalaries() {
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="card_box_header">
      <h3 style="margin:0">مدیریت معاشات پرسونل</h3>
      <button id="addStaffBtn" class="btn small">+ پرسونل جدید</button>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0">لیست پرسونل</h4>
          <input type="text" id="staffSearch" placeholder="جستجو..." style="width:150px;">
        </div>
        <div id="staffList" style="margin-top:10px; max-height:400px; overflow:auto;"></div>
      </div>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0">تاریخچه پرداخت‌ها</h4>
          <div style="display:flex; gap:6px;">
            <input type="text" id="paymentSearch" placeholder="جستجو..." style="width:120px;">
            <input type="month" id="paymentMonthFilter" style="width:140px;">
            <button id="addPaymentBtn" class="btn small">پرداخت  جدید</button>
          </div>
        </div>
        <div id="paymentList" style="margin-top:10px; max-height:400px; overflow:auto;"></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h4>خلاصه معاشات</h4>
      <div id="salarySummary" style="display:flex; flex-wrap:wrap; gap:16px;"></div>
    </div>
  `;
  mainArea.appendChild(container);

  let staffData = [];
  let paymentData = [];

  async function loadStaff() {
    const res = await fetch(API_BASE + "/staff");
    staffData = await res.json();
    renderStaffList();
    loadSummary();
  }
  async function loadPayments() {
    const search = container
      .querySelector("#paymentSearch")
      .value.trim()
      .toLowerCase();
    const monthFilter = container.querySelector("#paymentMonthFilter").value;
    let url = API_BASE + "/salary-payments?limit=1000";
    if (monthFilter) url += `&month=${monthFilter}`;
    const res = await fetch(url);
    let payments = await res.json();
    if (search) {
      payments = payments.filter(
        (p) =>
          p.staff_name?.toLowerCase().includes(search) ||
          p.note?.toLowerCase().includes(search),
      );
    }
    paymentData = payments;
    renderPaymentList();
    loadSummary();
  }
  async function loadSummary() {
    const res = await fetch(API_BASE + "/salary-payments/summary");
    const summary = await res.json();
    const summaryDiv = container.querySelector("#salarySummary");
    summaryDiv.innerHTML =
      summary
        .map((s) => {
          const balance = s.balance || 0;
          const balanceText =
            balance > 0
              ? `بدهی بالای کارمند : ${balance.toFixed(2)} اف`
              : balance < 0
                ? `بدهی بالای شرکت: ${(-balance).toFixed(2)} اف`
                : "تسویه";
          const balanceClass =
            balance > 0 ? "debt" : balance < 0 ? "credit" : "";

          // محاسبه مدت کارکرد
          let startDate = s.start_date ? new Date(s.start_date) : null;
          let endDate = s.end_date ? new Date(s.end_date) : new Date();
          let daysWorked = 0;
          let monthsWorked = 0;
          let periodText = "";
          if (startDate) {
            daysWorked =
              Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            monthsWorked = (daysWorked / 30.44).toFixed(1);
            const endDateText = s.end_date ? s.end_date.slice(0, 10) : "امروز";
            periodText = `از ${s.start_date.slice(0, 10)} تا ${endDateText} (${daysWorked} روز / ${monthsWorked} ماه)`;
          } else {
            periodText = "تاریخ شروع ثبت نشده است";
          }

          return `
      <div style="border:1px solid #eee; padding:8px; border-radius:8px; min-width:220px;">
        <div><strong>${s.name}</strong></div>
        <div>معاش تعیین شده : ${Number(s.base_salary || 0).toFixed(2)} اف</div>
        <div class="muted small">${periodText}</div>
        <div>معاش مورد انتظار (از شروع تا امروز): ${Number(s.total_expected || 0).toFixed(2)} اف</div>
        <div>مجموع پرداختی: ${Number(s.total_paid).toFixed(2)} اف</div>
        <div class="${balanceClass}" style="font-weight:bold; ${balance > 0 ? "color:#b91c1c" : balance < 0 ? "color:#0b5e8a" : ""}">${balanceText}</div>
      </div>
    `;
        })
        .join("") || '<div class="muted">هیچ پرسونلی ثبت نشده است.</div>';
  }

  function renderStaffList() {
    const search = container
      .querySelector("#staffSearch")
      .value.trim()
      .toLowerCase();
    const filtered = staffData.filter((s) =>
      s.name.toLowerCase().includes(search),
    );
    const listDiv = container.querySelector("#staffList");
    listDiv.innerHTML = filtered
      .map(
        (s) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #f5f6f8;">
        <div>
          <strong>${s.name}</strong>
          <div class="muted small">${s.position || "-"} — معاش تعیین شده: ${Number(s.base_salary || 0).toFixed(2)} اف</div>
          <div class="muted small">شروع: ${s.start_date ? s.start_date.slice(0, 10) : "-"} | پایان: ${s.end_date ? s.end_date.slice(0, 10) : "-"}</div>
         
          ${s.documents ? `<button class="btn-link view-docs" data-docs='${s.documents.replace(/'/g, "\\'")}' style="background:none; border:none; color:#0b74de; cursor:pointer; padding:0; margin-top:4px;">📎 مشاهده مدارک</button>` : ""}
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn small pay-staff" data-id="${s.id}" data-name="${s.name}">پرداخت معاش</button>
          <button class="btn ghost small edit-staff" data-id="${s.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
</svg>
</button>
          <button class="btn small danger delete-staff" data-id="${s.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>
        </div>
      </div>
    `,
      )
      .join("");
    listDiv.querySelectorAll(".pay-staff").forEach((btn) => {
      btn.addEventListener("click", () =>
        showSalaryPaymentForm(btn.dataset.id, btn.dataset.name),
      );
    });
    listDiv.querySelectorAll(".edit-staff").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const staff = staffData.find((s) => s.id === btn.dataset.id);
        if (staff) showStaffForm(staff);
      });
    });

    listDiv.querySelectorAll(".view-docs").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const docsJson = btn.getAttribute("data-docs");
        showDocumentsModal(docsJson);
      });
    });
    listDiv.querySelectorAll(".delete-staff").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("حذف شود؟")) return;
        await fetch(API_BASE + "/staff/" + btn.dataset.id, {
          method: "DELETE",
        });
        loadStaff();
        loadPayments();
      });
    });
  }

  function renderPaymentList() {
    const listDiv = container.querySelector("#paymentList");
    listDiv.innerHTML =
      paymentData
        .map(
          (p) => `
      <div style="display:flex; justify-content:space-between; align-items:center;flexWrap:wrap; padding:8px; border-bottom:1px solid #f5f6f8;">
        <div>
          <strong>${p.staff_name}</strong>
          <div class="muted small">مبلغ پرداختی: ${Number(p.amount).toFixed(2)} اف</div>
          <div class="muted small">معاش مبنا: ${Number(p.calculated_amount || 0).toFixed(2)} اف | بدهی: ${Number(p.debt_amount || 0).toFixed(2)} اف</div>
          <div class="muted small">ماه: ${p.month?.slice(0, 7)} — تاریخ پرداخت: ${new Date(p.paid_date).toLocaleDateString("fa-IR")}</div>
          ${p.note ? `<div class="muted small">توضیح: ${p.note}</div>` : ""}
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn ghost small edit-payment" data-id="${p.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
</svg>
</button>
          <button class="btn small danger delete-payment" data-id="${p.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>
        </div>
      </div>
    `,
        )
        .join("") ||
      '<div class="muted" style="padding:12px">هیچ پرداختی ثبت نشده است.</div>';

    listDiv.querySelectorAll(".edit-payment").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const payment = paymentData.find((p) => p.id === btn.dataset.id);
        if (payment)
          showSalaryPaymentForm(payment.staff_id, payment.staff_name, payment);
      });
    });
    listDiv.querySelectorAll(".delete-payment").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("حذف شود؟")) return;
        await fetch(API_BASE + "/salary-payments/" + btn.dataset.id, {
          method: "DELETE",
        });
        loadPayments();
      });
    });
  }

  container
    .querySelector("#staffSearch")
    .addEventListener("input", () => renderStaffList());
  container
    .querySelector("#paymentSearch")
    .addEventListener("input", () => loadPayments());
  container
    .querySelector("#paymentMonthFilter")
    .addEventListener("change", () => loadPayments());
  container
    .querySelector("#addStaffBtn")
    .addEventListener("click", () => showStaffForm());
  container.querySelector("#addPaymentBtn").addEventListener("click", () => {
    if (staffData.length === 0) {
      alert("لطفاً ابتدا پرسونلی ثبت کنید.");
      return;
    }
    showSalaryPaymentForm();
  });

  loadStaff();
  loadPayments();

  // فرم ثبت/ویرایش پرسونل با پشتیبانی از مدارک و تاریخ شروع/پایان
  async function showStaffForm(staff = null) {
    const isEdit = !!staff;
    let existingDocs = [];
    if (staff?.documents) {
      try {
        existingDocs = JSON.parse(staff.documents);
      } catch (e) {
        existingDocs = [staff.documents];
      }
    }

    const modalHtml = `
    <div id="staffModal" class="modal-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;">
      <div class="card" style="width:500px; max-width:90%;  height: 92VH;overflow: auto;">
        <h3>${isEdit ? "ویرایش پرسونل" : "پرسونل جدید"}</h3>
        <form id="staffForm">
          <label>نام</label><input name="name" value="${staff?.name || ""}" required>
          <label>وظیفه</label><input name="position" value="${staff?.position || ""}">
          <label>معاش تعیین شده (ماهانه اف)</label><input name="base_salary" type="number" step="0.01" value="${staff?.base_salary || ""}">
          <label>تاریخ شروع کار</label><input name="start_date" type="date" value="${staff?.start_date ? staff.start_date.slice(0, 10) : ""}" required>
          <label>تاریخ ترک کار (اختیاری)</label><input name="end_date" type="date" value="${staff?.end_date ? staff.end_date.slice(0, 10) : ""}">
          <label>مدارک (چندین عکس / PDF)</label>
          <input type="file" id="docFiles" multiple accept="image/*,application/pdf">
          <div id="docPreview" style="margin-top:6px;"></div>
          <input type="hidden" name="documents" value='${JSON.stringify(existingDocs)}'>
          <label>تماس</label><input name="contact" value="${staff?.contact || ""}">
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button type="submit" class="btn">ذخیره</button>
            <button type="button" class="btn ghost" id="closeStaffModal">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = document.getElementById("staffModal");
    const form = modal.querySelector("#staffForm");
    const fileInput = modal.querySelector("#docFiles");
    const docHidden = form.querySelector('input[name="documents"]');
    const previewDiv = modal.querySelector("#docPreview");

    function renderPreview(docsArray) {
      previewDiv.innerHTML = docsArray
        .map(
          (doc, idx) => `
      <div style="display:inline-block; margin:5px; position:relative; border:1px solid #ddd; border-radius:6px; padding:4px;">
        <button type="button" class="view-doc-preview" data-doc="${doc.replace(/"/g, "&quot;")}" style="background:none; border:none; cursor:pointer;">📄 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
</svg>
</button>
        <button type="button" class="remove-doc" data-index="${idx}" style="background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; margin-left:5px;">×</button>
      </div>
    `,
        )
        .join("");
      previewDiv.querySelectorAll(".remove-doc").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.index);
          const current = JSON.parse(docHidden.value);
          current.splice(idx, 1);
          docHidden.value = JSON.stringify(current);
          renderPreview(current);
        });
      });
      previewDiv.querySelectorAll(".view-doc-preview").forEach((btn) => {
        btn.addEventListener("click", () => {
          const doc = btn.getAttribute("data-doc");
          showDocumentsModal(JSON.stringify([doc]));
        });
      });
    }

    renderPreview(existingDocs);

    fileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const current = JSON.parse(docHidden.value);
      for (const file of files) {
        try {
          let compressed = await compressImage(file, 800, 0.8);
          current.push(compressed);
        } catch (err) {
          console.error("خطا در فشرده‌سازی فایل:", err);
          alert("خطا در پردازش فایل: " + file.name);
        }
      }
      docHidden.value = JSON.stringify(current);
      renderPreview(current);
      fileInput.value = "";
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        id: staff?.id,
        name: form.name.value.trim(),
        position: form.position.value.trim(),
        base_salary: form.base_salary.value
          ? Number(form.base_salary.value)
          : null,
        contact: form.contact.value.trim(),
        start_date: form.start_date.value || null,
        end_date: form.end_date.value || null,
        documents: docHidden.value,
      };
      const url = isEdit
        ? `${API_BASE}/staff/${staff.id}`
        : `${API_BASE}/staff`;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "خطا در ذخیره");
        return;
      }
      modal.remove();
      loadStaff();
      loadPayments();
    };
    modal.querySelector("#closeStaffModal").onclick = () => modal.remove();
  }

  // فرم ثبت/ویرایش معاش با محاسبه خودکار و نمایش بدهی
  // فرم ثبت/ویرایش معاش با محاسبه خودکار و جلوگیری از تکرار ماه
  async function showSalaryPaymentForm(
    staffId = null,
    staffName = null,
    payment = null,
  ) {
    const isEdit = !!payment;
    let staffOptions = staffData
      .map(
        (s) =>
          `<option value="${s.id}" ${staffId === s.id ? "selected" : ""}>${s.name}</option>`,
      )
      .join("");
    const defaultMonth = payment?.month ? payment.month.slice(0, 7) : "";
    const defaultAmount = payment?.amount || "";

    const modalHtml = `
    <div id="paymentModal" class="modal-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;">
      <div class="card" style="width:450px; max-width:90%;">
        <h3>${isEdit ? "ویرایش معاش" : "ثبت معاش جدید"}</h3>
        <form id="paymentForm">
          <label>پرسونل</label>
          <select name="staff_id" required>${staffOptions}</select>
          <label>ماه (مثلاً 2025-01)</label>
          <input name="month" type="month" value="${defaultMonth}" required>
          <div id="calcSalaryInfo" style="background:#f0f0f0; padding:6px; border-radius:6px; margin:6px 0; font-size:13px;">معاش محاسبه‌شده: ---</div>
          <label>مبلغ پرداختی واقعی (اف)</label>
          <input name="amount" type="number" step="0.01" value="${defaultAmount}" required>
          <div id="debtInfo" style="color:#b91c1c; font-size:13px;"></div>
          <label>تاریخ پرداخت</label>
          <input name="paid_date" type="datetime-local" value="${payment?.paid_date ? new Date(payment.paid_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}" required>
          <label>توضیحات</label><textarea name="note">${payment?.note || ""}</textarea>
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button type="submit" class="btn">ذخیره</button>
            <button type="button" class="btn ghost" id="closePaymentModal">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = document.getElementById("paymentModal");
    const form = modal.querySelector("#paymentForm");
    const staffSelect = form.querySelector('select[name="staff_id"]');
    const monthInput = form.querySelector('input[name="month"]');
    const amountInput = form.querySelector('input[name="amount"]');
    const calcInfoDiv = modal.querySelector("#calcSalaryInfo");
    const debtInfoDiv = modal.querySelector("#debtInfo");

    // تابع بررسی تکراری بودن پرداخت (فقط برای حالت جدید)
    async function isDuplicate() {
      if (isEdit) return false;
      const staff_id = staffSelect.value;
      const month = monthInput.value;
      if (!staff_id || !month) return false;
      // paymentData از scope بالایی (داخل renderSalaries) در دسترس است
      const existing = paymentData.find(
        (p) => p.staff_id === staff_id && p.month?.startsWith(month),
      );
      if (existing) {
        alert(`⚠️ قبلاً برای این پرسونل در ماه ${month} معاش ثبت شده است.`);
        return true;
      }
      return false;
    }

    // تابع محاسبه معاش مبنا از سرور
    async function updateCalculatedSalary() {
      const staff_id = staffSelect.value;
      const month = monthInput.value;
      if (!staff_id || !month) {
        calcInfoDiv.innerText = "معاش محاسبه‌شده: ---";
        debtInfoDiv.innerText = "";
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE}/salary-payments/calculate?staff_id=${staff_id}&month=${month}-01`,
        );
        if (res.ok) {
          const { calculated } = await res.json();
          calcInfoDiv.innerText = `معاش محاسبه‌شده بر اساس روزهای کاری: ${Number(calculated).toFixed(2)} $`;
          const paid = parseFloat(amountInput.value) || 0;
          const debt = paid - calculated;
          if (debt > 0)
            debtInfoDiv.innerText = `⚠️ اضافه‌پرداخت به عنوان بدهی کارمند ثبت می‌شود: ${debt.toFixed(2)} $`;
          else if (debt < 0)
            debtInfoDiv.innerText = `⚠️ کمتر از معاش محاسبه‌شده پرداخت شده (بدهی کارفرما): ${(-debt).toFixed(2)} $`;
          else debtInfoDiv.innerText = "";
        } else {
          calcInfoDiv.innerText = "خطا در محاسبه معاش";
        }
      } catch (err) {
        console.error(err);
        calcInfoDiv.innerText = "خطا";
      }
    }

    // رویدادها
    staffSelect.addEventListener("change", updateCalculatedSalary);
    monthInput.addEventListener("change", async () => {
      if (await isDuplicate()) {
        monthInput.value = ""; // پاک کردن ماه تکراری
      }
      updateCalculatedSalary();
    });
    amountInput.addEventListener("input", updateCalculatedSalary);
    if (!isEdit) updateCalculatedSalary();

    // ارسال فرم
    form.onsubmit = async (e) => {
      e.preventDefault();
      // بررسی نهایی تکرار (برای حالت جدید)
      if (!isEdit && (await isDuplicate())) return;

      const data = {
        id: payment?.id,
        staff_id: form.staff_id.value,
        amount: Number(form.amount.value),
        month: form.month.value + "-01",
        paid_date: form.paid_date.value,
        note: form.note.value,
      };
      const url = isEdit
        ? `${API_BASE}/salary-payments/${payment.id}`
        : `${API_BASE}/salary-payments`;
      const method = isEdit ? "PUT" : "POST";
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errData = await res.json();
          alert(errData.error || "خطا در ذخیره معاش");
          return;
        }
        modal.remove();
        loadPayments(); // تابع بازخوانی لیست پرداخت‌ها (داخل renderSalaries)
      } catch (err) {
        console.error(err);
        alert("خطا در ارتباط با سرور");
      }
    };

    modal.querySelector("#closePaymentModal").onclick = () => modal.remove();
  }
}
// ==================== پایان showInvoiceForm ====================
async function showProductForm(productId) {
  const isEdit = !!productId;
  const product = DB.data.products.find((p) => p.id === productId) || {
    id: uid("prod"),
    sku: "",
    name: "",
    category: "",
    locationId: "",
    minStock: 0,
    image: null,
  };

  const modal = document.createElement("div");
  modal.className = "card";
  modal.style.marginTop = "12px";

  const locationOptions = DB.data.locations
    .map(
      (l) =>
        `<option value="${l.id}" ${
          l.id === product.locationId ? "selected" : ""
        }>${l.name}</option>`,
    )
    .join("");

  modal.innerHTML = `
    <h3 class="card_tital_box"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"></path></svg> ${isEdit ? "ویرایش کالا" : "افزودن جنس جدید"} </h3>
    <form id="productForm">
      <label>کد/SKU</label>
      <input name="sku" value="${product.sku}">
      <label>اسم جنس</label>
      <input name="name" value="${product.name}" required>
      <label>دسته‌بندی</label>
      <input name="category" value="${product.category}">
      <label>موقعیت</label>
      <select name="locationId">
        <option value="">—</option>
        ${locationOptions}
      </select>
      <label>حداقل موجودی هشدار</label>
      <input name="minStock" type="number" value="${product.minStock || 0}">

      <!-- بخش تصویر کالا (اصلاح شده) -->
      <label>تصویر کالا</label>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <input type="file" id="productImageInput" accept="image/*">
        <button type="button" id="cameraCaptureBtn" class="btn small">📸 گرفتن عکس با دوربین</button>
        <img id="imagePreview" src="${product.image || ""}" style="max-width:100px; max-height:100px; border:1px solid #ddd; border-radius:4px; display:${product.image ? "block" : "none"};">
        <button type="button" id="removeImageBtn" style="display:${product.image ? "inline-block" : "none"}" class="btn small ghost">حذف تصویر</button>
      </div>

      <!-- مودال دوربین (مخفی در ابتدا) -->
      <div id="cameraModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:10050; align-items:center; justify-content:center;">
        <div style="background:#fff; border-radius:20px; width:90%; max-width:500px; padding:16px;">
          <video id="cameraVideo" autoplay playsinline style="width:100%; border-radius:12px;"></video>
          <div style="display:flex; gap:8px; margin-top:12px; justify-content:center;">
            <button id="capturePhotoBtn" class="btn">📸 عکس بگیر</button>
            <button id="closeCameraBtn" class="btn ghost">بستن</button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" type="submit">ذخیره</button>
        <button class="btn ghost" id="cancelProduct" type="button">انصراف</button>
        ${
          isEdit
            ? '<button class="btn danger" id="deleteProduct" type="button">حذف</button>'
            : ""
        }
      </div>
    </form>
  `;

  mainArea.prepend(modal);

  // ========== عناصر ==========
  const fileInput = modal.querySelector("#productImageInput");
  const preview = modal.querySelector("#imagePreview");
  const removeBtn = modal.querySelector("#removeImageBtn");
  const cameraBtn = modal.querySelector("#cameraCaptureBtn");
  const cameraModal = modal.querySelector("#cameraModal");
  const cameraVideo = modal.querySelector("#cameraVideo");
  const captureBtn = modal.querySelector("#capturePhotoBtn");
  const closeCameraBtn = modal.querySelector("#closeCameraBtn");
  let stream = null;

  // توقف استریم دوربین
  function stopCameraStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
  }

  // بستن مودال دوربین
  function closeCameraModal() {
    if (cameraModal) cameraModal.style.display = "none";
    stopCameraStream();
  }

  // باز کردن دوربین
  async function openCamera() {
    if (!cameraModal) return;
    cameraModal.style.display = "flex";
    try {
      const constraints = { video: { facingMode: { exact: "environment" } } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraVideo.srcObject = stream;
      await cameraVideo.play();
    } catch (err) {
      console.warn("دوربین عقب در دسترس نیست، تلاش با دوربین پیش‌فرض", err);
      try {
        const constraints = { video: true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraVideo.srcObject = stream;
        await cameraVideo.play();
      } catch (e) {
        alert("خطا در دسترسی به دوربین: " + e.message);
        closeCameraModal();
      }
    }
  }

  // گرفتن عکس و فشرده‌سازی
  function capturePhoto() {
    if (!cameraVideo) return;
    const canvas = document.createElement("canvas");
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    preview.src = compressedDataUrl;
    preview.style.display = "block";
    removeBtn.style.display = "inline-block";
    product.image = compressedDataUrl;
    closeCameraModal();
  }

  // رویدادها
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      preview.style.display = "block";
      const loadingMsg = document.createElement("div");
      loadingMsg.textContent = "در حال فشرده‌سازی...";
      loadingMsg.style.cssText =
        "margin-top:5px;color:#666;font-size:12px;font-style:italic";
      preview.parentNode.insertBefore(loadingMsg, preview.nextSibling);
      try {
        const compressed = await compressImage(file, 800, 0.8);
        loadingMsg.remove();
        preview.src = compressed;
        removeBtn.style.display = "inline-block";
        product.image = compressed;
      } catch (err) {
        loadingMsg.remove();
        console.error(err);
        alert("خطا در پردازش تصویر");
      }
    }
  });

  removeBtn.addEventListener("click", () => {
    fileInput.value = "";
    preview.src = "";
    preview.style.display = "none";
    removeBtn.style.display = "none";
    product.image = null;
  });

  if (cameraBtn) cameraBtn.addEventListener("click", openCamera);
  if (captureBtn) captureBtn.addEventListener("click", capturePhoto);
  if (closeCameraBtn)
    closeCameraBtn.addEventListener("click", closeCameraModal);
  if (cameraModal) {
    cameraModal.addEventListener("click", (e) => {
      if (e.target === cameraModal) closeCameraModal();
    });
  }

  modal.querySelector("#cancelProduct").onclick = () => modal.remove();

  if (isEdit) {
    const delBtn = modal.querySelector("#deleteProduct");
    if (delBtn) {
      delBtn.onclick = async () => {
        if (
          !confirm(
            "آیا مطمئن هستید؟ حذف کالا تمام معاملات مرتبط را حذف نمی‌کند.",
          )
        )
          return;
        try {
          await DB.deleteProduct(productId);
          modal.remove();
          renderMain("products");
        } catch (err) {
          console.error(err);
          alert("خطا در حذف کالا: " + err.message);
        }
      };
    }
  }

  // ========== ارسال فرم (اصلاح شده - فیلدهای قیمت حذف شده) ==========
  modal.querySelector("#productForm").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    product.sku = form.sku.value.trim();
    product.name = form.name.value.trim();
    product.category = form.category.value.trim();
    product.locationId = form.locationId.value || "";
    product.minStock = Number(form.minStock.value || 0);
    // قیمت‌های پیش‌فرض را null قرار می‌دهیم (چون در فرم وجود ندارند و در تراکنش ورود تعیین می‌شوند)
    product.defaultPurchasePrice = null;
    product.defaultSalePrice = null;
    // product.image قبلاً تنظیم شده

    try {
      if (isEdit) {
        await DB.updateProduct(product.id, product);
      } else {
        await DB.createProduct(product);
      }
      modal.remove();
      renderMain("products");
    } catch (err) {
      console.error("خطا در ذخیره کالا:", err);
      alert("خطا در ذخیره کالا: " + (err.message || err));
    }
  };
}
// async function showProductForm(productId) {
//   const isEdit = !!productId;
//   const product = DB.data.products.find((p) => p.id === productId) || {
//     id: uid("prod"),
//     sku: "",
//     name: "",
//     category: "",
//     locationId: "",
//     minStock: 0,
//     defaultPurchasePrice: null,
//     defaultSalePrice: null,
//     image: null,
//   };

//   const modal = document.createElement("div");
//   modal.className = "card";
//   modal.style.marginTop = "12px";

//   const locationOptions = DB.data.locations
//     .map(
//       (l) =>
//         `<option value="${l.id}" ${
//           l.id === product.locationId ? "selected" : ""
//         }>${l.name}</option>`,
//     )
//     .join("");

//   modal.innerHTML = `
//     <h3 class="card_tital_box"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"></path></svg> ${isEdit ? "ویرایش کالا" : "افزودن جنس جدید"} </h3>
//     <form id="productForm">
//       <label>کد/SKU</label>
//       <input name="sku" value="${product.sku}">
//       <label>اسم جنس</label>
//       <input name="name" value="${product.name}" required>
//       <label>دسته‌بندی</label>
//       <input name="category" value="${product.category}">
//       <label>قیمت خرید پیش‌فرض $</label>
//       <input name="defaultPurchasePrice" type="number" step="0.01" value="${product.defaultPurchasePrice ?? ""}">
//       <label>قیمت فروش پیش‌فرض $</label>
//       <input name="defaultSalePrice" type="number" step="0.01" value="${product.defaultSalePrice ?? ""}">
//       <label>موقعیت</label>
//       <select name="locationId">
//         <option value="">—</option>
//         ${locationOptions}
//       </select>
//       <label>حداقل موجودی هشدار</label>
//       <input name="minStock" type="number" value="${product.minStock || 0}">

//       <!-- بخش آپلود تصویر -->
//       <label>تصویر کالا</label>
//       <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
//         <input type="file" id="productImageInput" accept="image/*">
//         <img id="imagePreview" src="${product.image || ""}" style="max-width:100px; max-height:100px; border:1px solid #ddd; border-radius:4px; display:${product.image ? "block" : "none"};">
//         <button type="button" id="removeImageBtn" style="display:${product.image ? "inline-block" : "none"};">حذف تصویر</button>
//       </div>
//       // بخش تصویر کالا (جایگزین)
// <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
//   <input type="file" id="productImageInput" accept="image/*">
//   <button type="button" id="cameraCaptureBtn" class="btn small">📸 گرفتن عکس با دوربین</button>
//   <img id="imagePreview" src="${product.image || ""}" style="max-width:100px; max-height:100px; border:1px solid #ddd; border-radius:4px; display:${product.image ? "block" : "none"};">
//   <button type="button" id="removeImageBtn" style="display:${product.image ? "inline-block" : "none"}" class="btn small ghost">حذف تصویر</button>
// </div>

// <!-- مودال دوربین (مخفی در ابتدا) -->
// <div id="cameraModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:10050; align-items:center; justify-content:center;">
//   <div style="background:#fff; border-radius:20px; width:90%; max-width:500px; padding:16px;">
//     <video id="cameraVideo" autoplay playsinline style="width:100%; border-radius:12px;"></video>
//     <div style="display:flex; gap:8px; margin-top:12px; justify-content:center;">
//       <button id="capturePhotoBtn" class="btn">📸 عکس بگیر</button>
//       <button id="closeCameraBtn" class="btn ghost">بستن</button>
//     </div>
//   </div>
// </div>

//       <div style="display:flex;gap:8px;margin-top:10px">
//         <button class="btn" type="submit">ذخیره</button>
//         <button class="btn ghost" id="cancelProduct" type="button">انصراف</button>

//       </div>
//     </form>
//   `;

//   mainArea.prepend(modal);

//   const fileInput = modal.querySelector("#productImageInput");
//   const preview = modal.querySelector("#imagePreview");
//   const removeBtn = modal.querySelector("#removeImageBtn");

//   fileInput.addEventListener("change", async (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       // 1. پاک کردن پیش‌نمایش قبلی و نمایش پیام
//       preview.src = ""; // یا می‌توانید یک placeholder بگذارید
//       preview.style.display = "block";

//       // ایجاد المان پیام
//       const loadingMsg = document.createElement("div");
//       loadingMsg.textContent = "در حال فشرده‌سازی...";
//       loadingMsg.style.marginTop = "5px";
//       loadingMsg.style.color = "#666";
//       loadingMsg.style.fontSize = "12px";
//       loadingMsg.style.fontStyle = "italic";

//       // قرار دادن پیام بعد از پیش‌نمایش
//       preview.parentNode.insertBefore(loadingMsg, preview.nextSibling);

//       try {
//         // 2. فشرده‌سازی تصویر
//         const compressed = await compressImage(file, 800, 0.8);

//         // 3. حذف پیام و نمایش تصویر فشرده
//         loadingMsg.remove();
//         preview.src = compressed;
//         removeBtn.style.display = "inline-block";

//         // 4. ذخیره تصویر فشرده در آبجکت product (برای ارسال به سرور)
//         product.image = compressed;
//       } catch (err) {
//         // 5. در صورت خطا، پیام را حذف و اخطار بده
//         loadingMsg.remove();
//         console.error("خطا در فشرده‌سازی تصویر:", err);
//         alert("خطا در پردازش تصویر");
//       }
//     }
//   });

//   removeBtn.addEventListener("click", () => {
//     fileInput.value = "";
//     preview.src = "";
//     preview.style.display = "none";
//     removeBtn.style.display = "none";
//     product.image = null;
//   });

//   modal.querySelector("#cancelProduct").onclick = () => modal.remove();

//   modal.querySelector("#productForm").onsubmit = async (e) => {
//     e.preventDefault();
//     const form = e.target;
//     product.sku = form.sku.value.trim();
//     product.name = form.name.value.trim();
//     product.category = form.category.value.trim();
//     product.locationId = form.locationId.value || "";
//     product.minStock = Number(form.minStock.value || 0);
//     product.defaultPurchasePrice = form.defaultPurchasePrice.value
//       ? Number(form.defaultPurchasePrice.value)
//       : null;
//     product.defaultSalePrice = form.defaultSalePrice.value
//       ? Number(form.defaultSalePrice.value)
//       : null;
//     // توجه: product.image قبلاً توسط FileReader به‌روز شده است

//     try {
//       if (isEdit) {
//         await DB.updateProduct(product.id, product);
//       } else {
//         await DB.createProduct(product);
//       }
//       modal.remove();
//       renderMain("products");
//     } catch (err) {
//       console.error("خطا در ذخیره کالا:", err);
//       alert("خطا در ذخیره کالا: " + (err.message || err));
//     }
//   };
// }

/********** Suppliers ***********/
function renderSuppliers() {
  const c = document.createElement("div");
  c.innerHTML = `
    <div class="card_box_header">
      <h3 style="margin:0">تامین‌کنندگان</h3>
      <div style="display:flex;align-items:center;gap:20px;">
        <div class="innerbox_header" style="font-size:14px; padding:6px 12px; border-radius:20px;">
          <span>💰 کل بدهی: <strong id="totalDebtAll">0.00</strong> $</span>
          <span style="margin:0 10px;">|</span>
          <span>🏷️ کل تخفیف دریافتی: <strong id="totalDiscountAll">0.00</strong> $</span>
          <span style="margin:0 10px;">|</span>
          <span>📦 کل خرید از تامین‌کنندگان: <strong id="totalPurchaseAll">0.00</strong> $</span>
        </div>
      </div>
      <button id="addSupplier" class="btn small card_tital_box">+ تامین‌کننده جدید</button>
    </div>
    <div style="margin-top:10px" class="card list">
      <div class="search">
        <input id="supplierSearch" placeholder="جستجو (نام یا تماس)..." style="flex:1;">
      </div>
      <div id="supplierList"></div>
    </div>
  `;
  mainArea.appendChild(c);
  c.querySelector("#addSupplier").onclick = () => showSupplierForm();
  const searchInput = c.querySelector("#supplierSearch");
  searchInput.addEventListener("input", () => drawSuppliers());

  function drawSuppliers() {
    const searchText = searchInput.value.trim().toLowerCase();
    let filtered = DB.data.suppliers;
    if (searchText) {
      filtered = DB.data.suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(searchText) ||
          (s.contact || "").toLowerCase().includes(searchText),
      );
    }

    // محاسبه آمار کلی
    let totalDebtAll = 0,
      totalDiscountAll = 0,
      totalPurchaseAll = 0;
    for (const s of filtered) {
      totalDebtAll += Number(s.total_debt) || 0;
      totalDiscountAll += Number(s.total_discount) || 0;
      // محاسبه کل خرید از هر تامین‌کننده (جمع مبلغ کل تراکنش‌های in)
      const purchases = DB.data.transactions.filter(
        (t) => t.type === "in" && t.supplierId === s.id,
      );
      const sumPurchase = purchases.reduce(
        (sum, t) => sum + (Number(t.amount) || 0),
        0,
      );
      totalPurchaseAll += sumPurchase;
    }
    document.getElementById("totalDebtAll").textContent =
      totalDebtAll.toFixed(2);
    document.getElementById("totalDiscountAll").textContent =
      totalDiscountAll.toFixed(2);
    document.getElementById("totalPurchaseAll").textContent =
      totalPurchaseAll.toFixed(2);

    const list = c.querySelector("#supplierList");
    list.innerHTML =
      filtered
        .map((s) => {
          let debt = Number(s.total_debt) || 0;
          if (debt < 0) debt = 0;
          const discount = Number(s.total_discount) || 0;
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #f5f6f8">
            <div>
              <strong>${escapeHtml(s.name)}</strong>
              <div class="muted small">${escapeHtml(s.contact || "")}</div>
              <div class="muted small" style="color: #b91c1c;">بدهی: ${debt.toFixed(2)} $</div>
              <div class="muted small" style="color: #0b5e8a;">تخفیف دریافتی: ${discount.toFixed(2)} $</div>
            </div>
            <div style="display:flex;gap:6px; align-items:center; flex-wrap:wrap;">
              ${debt > 0 ? `<button style=" display: none;" class="btn small pay-supplier-debt" data-id="${s.id}" data-debt="${debt}">💰 تسویه بدهی</button>` : ""}
              <button class="btn small view-debt-details" data-id="${s.id}" data-name="${escapeHtml(s.name)}">📋 جزئیات خرید</button>
              <button class="btn small" data-id="${s.id}" data-action="edit">ویرایش</button>
              <button class="btn small danger" data-id="${s.id}" data-action="delete">حذف</button>
            </div>
          </div>
        `;
        })
        .join("") ||
      '<div class="muted" style="padding:12px">موردی یافت نشد</div>';

    // دکمه پرداخت بدهی
    list.querySelectorAll(".pay-supplier-debt").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const supplierId = btn.getAttribute("data-id");
        const currentDebt = parseFloat(btn.getAttribute("data-debt"));
        if (isNaN(currentDebt)) return;
        const amount = prompt(
          `مبلغ تسویه بدهی (حداکثر ${currentDebt.toFixed(2)} $):`,
          currentDebt.toFixed(2),
        );
        if (!amount) return;
        let payAmount = parseFloat(amount.replace(/,/g, "."));
        if (isNaN(payAmount) || payAmount <= 0 || payAmount > currentDebt) {
          alert("مبلغ نامعتبر");
          return;
        }
        try {
          const res = await fetch(
            `${API_BASE}/suppliers/${supplierId}/pay-debt`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: payAmount }),
            },
          );
          if (!res.ok) throw new Error(await res.text());
          alert("پرداخت با موفقیت ثبت شد");
          await DB.load();
          renderMain("suppliers");
        } catch (err) {
          alert("خطا: " + err.message);
        }
      });
    });

    // دکمه جزئیات بدهی
    list.querySelectorAll(".view-debt-details").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const supplierId = btn.getAttribute("data-id");
        const supplierName = btn.getAttribute("data-name");
        await showSupplierDebtDetails(supplierId, supplierName);
      });
    });

    list.querySelectorAll("button[data-action='edit']").forEach((b) => {
      b.onclick = async () => {
        const id = b.getAttribute("data-id");
        await showSupplierForm(id);
      };
    });
    list.querySelectorAll("button[data-action='delete']").forEach((b) => {
      b.onclick = async () => {
        const id = b.getAttribute("data-id");
        if (!confirm("حذف شود؟")) return;
        await DB.deleteSupplier(id);
        drawSuppliers();
      };
    });
  }
  drawSuppliers();
}

async function showSupplierForm(id) {
  const isEdit = !!id;
  const s = DB.data.suppliers.find((x) => x.id === id) || {
    id: uid("sup"),
    name: "",
    contact: "",
  };
  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";
  card.innerHTML = `
          <h3 class="card_tital_box"><svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"></path></svg> ${isEdit ? "ویرایش تامین کننده" : "افزودن تامین کننده"}</h3>
          <form id="supplierForm">
            <label>نام</label><input name="name" value="${s.name}" required>
            <label>تماس / توضیحات</label><input name="contact" value="${s.contact}">
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn" type="submit">ذخیره</button>
              <button class="btn ghost" id="cancelSup" type="button">انصراف</button>
            </div>
          </form>
        `;
  mainArea.prepend(card);
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100); // تأخیر ۱۰۰ میلی‌ثانیه برای اطمینان از رندر شدن کامل

  card.querySelector("#cancelSup").onclick = () => card.remove();

  card.querySelector("#supplierForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    s.name = f.name.value.trim();
    s.contact = f.contact.value.trim();
    if (isEdit) {
      await DB.updateSupplier(s.id, s);
    } else {
      await DB.createSupplier(s);
    }
    card.remove();
    renderMain("suppliers");
  };
}

/********** Locations ***********/
function renderLocations() {
  const c = document.createElement("div");
  c.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">موقعیت‌های انبار</h3><button id="addLocation" class="btn small">موقعیت جدید</button></div>
          <div style="margin-top:10px" class="card list"><div id="locationList"></div></div>
        `;
  mainArea.appendChild(c);
  c.querySelector("#addLocation").onclick = () => showLocationForm();
  drawLocations();

  function drawLocations() {
    const list = c.querySelector("#locationList");
    list.innerHTML =
      DB.data.locations
        .map(
          (l) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #f5f6f8">
              <div><strong>${l.name}</strong></div>
              <div style="display:flex;gap:6px">
                <button class="btn small" data-id="${l.id}" data-action="edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
</svg>
</button>
                <button class="btn small danger" data-id="${l.id}" data-action="delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>
              </div>
            </div>
          `,
        )
        .join("") ||
      '<div class="muted" style="padding:12px">موردی یافت نشد</div>';

    list.querySelectorAll("button").forEach((b) => {
      b.onclick = async () => {
        const id = b.getAttribute("data-id");
        const action = b.getAttribute("data-action");
        if (action === "edit") showLocationForm(id);
        if (action === "delete") {
          if (!confirm("حذف شود؟")) return;
          await DB.deleteLocation(id);
          drawLocations();
          refreshFilterLocations();
        }
      };
    });
  }
}

async function showLocationForm(id) {
  const isEdit = !!id;
  const l = DB.data.locations.find((x) => x.id === id) || {
    id: uid("loc"),
    name: "",
  };
  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";
  card.innerHTML = `
          <h3>${isEdit ? "ویرایش موقعیت" : "موقعیت جدید"}</h3>
          <form id="locForm">
            <label>نام موقعیت (مثلاً قفسه A1)</label><input name="name" value="${l.name}" required>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn" type="submit">ذخیره</button>
              <button class="btn ghost" id="cancelLoc" type="button">انصراف</button>
            </div>
          </form>
        `;
  mainArea.prepend(card);
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100); // تأخیر ۱۰۰ میلی‌ثانیه برای اطمینان از رندر شدن کامل

  card.querySelector("#cancelLoc").onclick = () => card.remove();

  card.querySelector("#locForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    l.name = f.name.value.trim();
    if (isEdit) {
      await DB.updateLocation(l.id, l);
    } else {
      await DB.createLocation(l);
    }
    card.remove();
    renderMain("locations");
    refreshFilterLocations();
  };
}

function renderExpenses() {
  const c = document.createElement("div");

  // HTML اولیه با placeholder برای مقادیر آماری
  c.innerHTML = `
    <div class="card_box_header">
      <h3 style="margin:0">مصارف</h3>
      <div style="display:flex;align-items:center;gap:20px;">
        <div class="innerbox_header" style="font-size:14px;  padding:6px 12px; border-radius:20px;">
          <span>📊 تعداد کل: <strong id="expenseCountDisplay">0</strong></span>
          <span style="margin:0 8px;">|</span>
          <span>💰 مجموع هزینه: <strong id="expenseTotalDisplay">0.00</strong> اف</span>
        </div>
        
      </div>
      <button id="addExpense" class="btn small">افزودن مصرف</button>
    </div>
    <div style="margin-top:10px" class="card">
      <div class="filters" style="display:flex;flex-wrap:wrap;gap:10px;padding:10px;border-radius:8px;margin-bottom:10px;">
        <input id="expSearch" placeholder="جستجو..." style="flex:2; min-width:200px;">
        <input type="date" id="expDateFrom" style="width:140px;" placeholder="از تاریخ">
        <span>تا</span>
        <input type="date" id="expDateTo" style="width:140px;">
        <input type="number" id="expAmountMin" placeholder="حداقل مبلغ" style="width:120px;">
        <input type="number" id="expAmountMax" placeholder="حداکثر مبلغ" style="width:120px;">
        <input id="expCategory" placeholder="دسته‌بندی" style="width:150px;">
      </div>
      <div id="expenseList"></div>
    </div>
  `;

  mainArea.appendChild(c);

  const searchInput = c.querySelector("#expSearch");
  const dateFrom = c.querySelector("#expDateFrom");
  const dateTo = c.querySelector("#expDateTo");
  const amountMin = c.querySelector("#expAmountMin");
  const amountMax = c.querySelector("#expAmountMax");
  const categoryInput = c.querySelector("#expCategory");
  const addBtn = c.querySelector("#addExpense");

  // ارجاع به المان‌های نمایش آمار
  const countDisplay = document.getElementById("expenseCountDisplay");
  const totalDisplay = document.getElementById("expenseTotalDisplay");

  addBtn.onclick = () => showExpenseForm();

  function drawExpenses() {
    const q = searchInput.value.trim().toLowerCase();
    const fromDate = dateFrom.value ? new Date(dateFrom.value) : null;
    const toDate = dateTo.value ? new Date(dateTo.value) : null;
    const minAmt = amountMin.value ? Number(amountMin.value) : null;
    const maxAmt = amountMax.value ? Number(amountMax.value) : null;
    const catQ = categoryInput.value.trim().toLowerCase();

    const filtered = DB.data.expenses
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((exp) => {
        if (q) {
          const text = (exp.description + " " + exp.category).toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (catQ && !exp.category.toLowerCase().includes(catQ)) return false;
        if (fromDate || toDate) {
          const d = new Date(exp.date);
          if (fromDate && d < fromDate) return false;
          if (toDate) {
            const next = new Date(toDate);
            next.setDate(next.getDate() + 1);
            if (d >= next) return false;
          }
        }
        const amt = Number(exp.amount);
        if (minAmt !== null && amt < minAmt) return false;
        if (maxAmt !== null && amt > maxAmt) return false;
        return true;
      });

    // محاسبه آمار
    const totalCount = filtered.length;
    const totalAmount = filtered.reduce(
      (sum, exp) => sum + Number(exp.amount || 0),
      0,
    );

    // به‌روزرسانی نوار بالا
    countDisplay.textContent = totalCount;
    totalDisplay.textContent = totalAmount.toFixed(2);

    const list = c.querySelector("#expenseList");
    list.innerHTML =
      filtered
        .map(
          (exp) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #f5f6f8">
        <div style="flex:2">
          <strong>${exp.description || "بدون توضیح"}</strong>
          <div class="muted small">${exp.category || "-"} — ${exp.date.split("T")[0]}</div>
        </div>
        <div style="width:120px;text-align:right;font-weight:600">${Number(exp.amount).toFixed(2)} اف</div>
        <div style="display:flex;gap:6px">
          <button class="btn small" data-id="${exp.id}" data-action="edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
</svg>
</button>
          <button class="btn small danger" data-id="${exp.id}" data-action="delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>
        </div>
      </div>
    `,
        )
        .join("") ||
      '<div class="muted" style="padding:12px">موردی یافت نشد</div>';

    list.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
      btn.onclick = () => showExpenseForm(btn.dataset.id);
    });
    list.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("حذف شود؟")) return;
        await DB.deleteExpense(btn.dataset.id);
        drawExpenses();
      };
    });
  }

  // رویدادها برای فیلترها
  [searchInput, dateFrom, dateTo, amountMin, amountMax, categoryInput].forEach(
    (el) => {
      el.addEventListener("input", drawExpenses);
      el.addEventListener("change", drawExpenses);
    },
  );

  drawExpenses();
}

/********** Transactions (ورود/خروج) ***********/
function renderTransactions() {
  const c = document.createElement("div");
  c.innerHTML = `
    <div>
      <div class="card_box_header">
        <h3 style="margin:0">معاملات</h3>
        <div style="display:flex;align-items:center;gap:20px;">
          <div class="innerbox_header" style="font-size:14px; padding:6px 12px; border-radius:20px;">
            <span>📊 تعداد کل: <strong id="totalCountDisplay">0</strong></span>
            <span style="margin:0 8px;">|</span>
            <span>💰 هزینه کل: <strong id="totalPurchaseDisplay">0.00</strong> $</span>
            <span style="margin:0 8px;">|</span>
            <span>💸 عاید : <strong id="totalOutDisplay">0.00</strong> $</span>
            <span style="margin:0 8px;">|</span>
            <span>📈 سود : <strong id="netDisplay">0.00</strong> $</span>
            <span style="margin:0 8px;">|</span>
            <span style="color:#b91c1c;">📉 بدهی: <strong id="totalDebtDisplay">0.00</strong> $</span>
            <span style="margin:0 8px;">|</span>
            <span style="color:#0b5e8a;">🏷️ تخفیف: <strong id="totalDiscountDisplay">0.00</strong> $</span>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top:10px" class="card">
      <div class="filters" style="display:flex; flex-wrap:wrap; gap:10px; padding:10px; border-radius:8px; margin-bottom:10px;">
        <input id="txSearch" placeholder="جستجو..." style="flex:2; min-width:200px;">
        <select id="txTypeFilter" style="width:120px;">
          <option value="all">همه</option>
          <option value="in">ورود</option>
          <option value="out">خروج</option>
          <option value="sales">فروشات</option>
        </select>
        <select id="txDebtFilter" style="width:140px;">
          <option value="all">همه (بدون فیلتر)</option>
          <option value="debt">دارای بدهی</option>
          <option value="discount">دارای تخفیف</option>
        </select>
        <div style="display:flex;flex-wrap:wrap; gap:5px; align-items:center;">
          <span>تاریخ:</span>
          <input type="date" id="txDateFrom" style="width:140px;">
          <span>تا</span>
          <input type="date" id="txDateTo" style="width:140px;">
        </div>
        <div style="display:flex; gap:5px; align-items:center;">
          <span>مبلغ:</span>
          <input type="number" id="txAmountMin" placeholder="حداقل" step="0.01" style="width:100px;">
          <span>تا</span>
          <input type="number" id="txAmountMax" placeholder="حداکثر" step="0.01" style="width:100px;">
        </div>
        <input id="txSerialSearch" placeholder="سریال..." style="width:150px;">
      </div>
      <div style="overflow-x: auto;">
        <table style="width:100%; border-collapse:collapse; min-width:1000px;">
          <thead>
            <tr>
              <th style="text-align:right; padding:10px;">کالا / فاکتور</th>
              <th style="text-align:center; padding:10px; width:70px;">تعداد</th>
              <th style="text-align:center; padding:10px; width:100px;">قیمت خرید</th>
              <th style="text-align:center; padding:10px; width:100px;">قیمت فروش </th>
              <th style="text-align:center; padding:10px; width:100px;">مبلغ کل</th>
              <th style="text-align:center; padding:10px; width:100px;">سود</th>
              <th style="text-align:right; padding:10px;">مشتری / توضیحات</th>
            </tr>
          </thead>
          <tbody id="txList"></tbody>
        </table>
      </div>
    </div>
  `;
  mainArea.appendChild(c);

  const totalPurchaseDisplay = document.getElementById("totalPurchaseDisplay");
  const totalCountDisplay = document.getElementById("totalCountDisplay");
  const totalOutDisplay = document.getElementById("totalOutDisplay");
  const netDisplay = document.getElementById("netDisplay");
  const totalDebtDisplay = document.getElementById("totalDebtDisplay");
  const totalDiscountDisplay = document.getElementById("totalDiscountDisplay");

  const searchInput = c.querySelector("#txSearch");
  const typeFilter = c.querySelector("#txTypeFilter");
  const debtFilter = c.querySelector("#txDebtFilter");
  const dateFrom = c.querySelector("#txDateFrom");
  const dateTo = c.querySelector("#txDateTo");
  const amountMin = c.querySelector("#txAmountMin");
  const amountMax = c.querySelector("#txAmountMax");
  const serialSearch = c.querySelector("#txSerialSearch");
  const tbody = c.querySelector("#txList");

  if (typeFilter) typeFilter.value = "sales";

  async function openInvoiceFromId(invoiceId) {
    try {
      const invFull = await DB.getInvoice(invoiceId);
      if (!invFull) throw new Error("فاکتور یافت نشد");
      const customer =
        DB.data.customers.find((c) => c.id === invFull.invoice.customer_id) ||
        null;
      openReceiptWindow(invFull.invoice, invFull.items, customer);
    } catch (err) {
      alert(err.message);
    }
  }

  function applyBasicFilters(
    transactions,
    fromDate,
    toDate,
    minAmt,
    maxAmt,
    serialQ,
    searchText,
  ) {
    return transactions.filter((t) => {
      const txDate = new Date(t.date);
      if (fromDate && txDate < fromDate) return false;
      if (toDate) {
        const nextDay = new Date(toDate);
        nextDay.setDate(nextDay.getDate() + 1);
        if (txDate >= nextDay) return false;
      }
      const amt = Number(t.amount);
      if (minAmt !== null && amt < minAmt) return false;
      if (maxAmt !== null && amt > maxAmt) return false;
      if (serialQ && t.serials) {
        const serialMatch = t.serials.some((s) =>
          s.toLowerCase().includes(serialQ),
        );
        if (!serialMatch) return false;
      }
      if (searchText) {
        const pName =
          DB.data.products.find((p) => p.id === t.productId)?.name || "";
        const custName = t.customerName || "";
        if (
          !pName.toLowerCase().includes(searchText) &&
          !custName.toLowerCase().includes(searchText) &&
          !(t.note || "").toLowerCase().includes(searchText)
        )
          return false;
      }
      return true;
    });
  }

  function drawTx() {
    const searchText = searchInput.value.trim().toLowerCase();
    const type = typeFilter.value;
    const debtType = debtFilter.value;
    const fromDate = dateFrom.value ? new Date(dateFrom.value) : null;
    const toDate = dateTo.value ? new Date(dateTo.value) : null;
    const minAmt = amountMin.value ? Number(amountMin.value) : null;
    const maxAmt = amountMax.value ? Number(amountMax.value) : null;
    const serialQ = serialSearch.value.trim().toLowerCase();

    const allTransactions = DB.data.transactions;
    let displayItems = [];

    if (type === "sales") {
      let outTransactions = allTransactions.filter((t) => t.type === "out");
      outTransactions = applyBasicFilters(
        outTransactions,
        fromDate,
        toDate,
        minAmt,
        maxAmt,
        serialQ,
        searchText,
      );

      const invoiceMap = new Map();
      for (const t of outTransactions) {
        const match = t.note?.match(/sale invoice:(\S+)/);
        if (!match) continue;
        const invoiceId = match[1];
        if (!invoiceMap.has(invoiceId)) {
          const invoice = DB.data.invoices.find((inv) => inv.id === invoiceId);
          invoiceMap.set(invoiceId, {
            id: invoiceId,
            customer_name: invoice?.customer_name || "-",
            date: invoice?.date || t.date,
            total_qty: 0,
            total_revenue: 0,
            total_purchase_cost: 0,
            remaining_action: invoice?.remaining_action,
            paid_amount: invoice?.paid_amount || 0,
            serials: new Set(),
            products: new Map(),
          });
        }
        const group = invoiceMap.get(invoiceId);
        const qty = Number(t.qty);
        const revenue = Number(t.amount);
        let purchaseCost = 0;
        if (t.serials && t.serials.length) {
          for (const serial of t.serials) {
            const serialData = DB.data.serials?.find(
              (s) => s.serial === serial && s.product_id === t.productId,
            );
            if (serialData && serialData.purchase_price !== null) {
              purchaseCost += Number(serialData.purchase_price);
            } else {
              const prod = DB.data.products.find((p) => p.id === t.productId);
              if (prod && prod.defaultPurchasePrice !== null)
                purchaseCost += Number(prod.defaultPurchasePrice);
            }
          }
        } else {
          const prod = DB.data.products.find((p) => p.id === t.productId);
          if (prod && prod.defaultPurchasePrice !== null)
            purchaseCost = Number(prod.defaultPurchasePrice) * qty;
        }

        group.total_qty += qty;
        group.total_revenue += revenue;
        group.total_purchase_cost += purchaseCost;
        if (t.serials) t.serials.forEach((s) => group.serials.add(s));

        const prod = DB.data.products.find((p) => p.id === t.productId);
        const prodName = prod ? prod.name : t.productId;
        if (!group.products.has(t.productId)) {
          group.products.set(t.productId, {
            name: prodName,
            qty: 0,
            purchaseCost: 0,
            revenue: 0,
          });
        }
        const prodInfo = group.products.get(t.productId);
        prodInfo.qty += qty;
        prodInfo.purchaseCost += purchaseCost;
        prodInfo.revenue += revenue;
      }

      let groups = [];
      for (const group of invoiceMap.values()) {
        if (group.total_qty === 0) continue;
        group.avg_purchase = group.total_purchase_cost / group.total_qty;
        group.avg_sale = group.total_revenue / group.total_qty;
        const remaining = group.total_revenue - group.paid_amount;
        let discountAmount = 0,
          debtAmount = 0;
        if (remaining > 0) {
          if (group.remaining_action === "discount") discountAmount = remaining;
          else if (group.remaining_action === "debt") debtAmount = remaining;
        }
        group.discount_amount = discountAmount;
        group.debt_amount = debtAmount;
        const actualRevenue = group.total_revenue - discountAmount;
        group.profit = actualRevenue - group.total_purchase_cost;
        groups.push(group);
      }

      if (debtType === "debt") groups = groups.filter((g) => g.debt_amount > 0);
      else if (debtType === "discount")
        groups = groups.filter((g) => g.discount_amount > 0);
      displayItems = groups;
    } else {
      let filtered = allTransactions.filter((t) => {
        if (type === "all") return true;
        if (type === "in") return t.type === "in";
        if (type === "out") return t.type === "out";
        return false;
      });
      filtered = applyBasicFilters(
        filtered,
        fromDate,
        toDate,
        minAmt,
        maxAmt,
        serialQ,
        searchText,
      );
      if (debtType === "debt") {
        filtered = filtered.filter(
          (t) => t.hasDebt === true && Number(t.debtAmount) > 0,
        );
      } else if (debtType === "discount") {
        filtered = filtered.filter(
          (t) => t.hasDiscount === true && Number(t.discountAmount) > 0,
        );
      }
      displayItems = filtered.map((t) => ({
        id: t.id,
        type: t.type,
        productId: t.productId,
        qty: t.qty,
        unitPrice: t.unitPrice,
        amount: t.amount,
        profit: t.profit,
        serials: t.serials,
        date: t.date,
        customer_name: t.customerName,
        hasDebt: t.hasDebt,
        debtAmount: t.debtAmount,
        hasDiscount: t.hasDiscount,
        discountAmount: t.discountAmount,
      }));
    }

    let totalCount = displayItems.length;
    let totalPurchase = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalDebt = 0;
    let totalDiscount = 0;

    for (const item of displayItems) {
      if (type === "sales") {
        totalRevenue += item.total_revenue;
        totalPurchase += item.total_purchase_cost;
        totalProfit += item.profit;
        totalDebt += item.debt_amount;
        totalDiscount += item.discount_amount;
      } else {
        if (item.type === "out") {
          totalRevenue += Number(item.amount);
          totalProfit += Number(item.profit);
          totalDebt += Number(item.debtAmount);
          totalDiscount += Number(item.discountAmount);
        } else if (item.type === "in") {
          const totalPurchase = item.qty * item.unitPrice;
          const paid = item.paid_to_supplier || 0;
          const remaining = totalPurchase - paid;
          if (remaining > 0) {
            if (item.supplier_remaining_action === "debt") {
              statusBadge = `بدهی به تأمین‌کننده: ${remaining.toFixed(2)} $`;
            } else {
              statusBadge = `تخفیف از تأمین‌کننده: ${remaining.toFixed(2)} $`;
            }
          } else {
            statusBadge = "تسویه شده";
          }
        }
      }
    }

    totalCountDisplay.textContent = totalCount;
    totalPurchaseDisplay.textContent = (
      typeof totalPurchase === "number" ? totalPurchase : 0
    ).toFixed(2);
    totalOutDisplay.textContent = (
      typeof totalRevenue === "number" ? totalRevenue : 0
    ).toFixed(2);
    netDisplay.textContent = (
      typeof totalProfit === "number" ? totalProfit : 0
    ).toFixed(2);
    totalDebtDisplay.textContent = (
      typeof totalDebt === "number" ? totalDebt : 0
    ).toFixed(2);
    totalDiscountDisplay.textContent = (
      typeof totalDiscount === "number" ? totalDiscount : 0
    ).toFixed(2);

    const rowsHtml = displayItems
      .map((item) => {
        if (type === "sales") {
          let productsHtml = "";
          for (const prod of item.products.values()) {
            productsHtml += `<div class="muted small" style="font-size:12px;">• ${prod.name} (${prod.qty} عدد) - ${Number(prod.revenue).toFixed(2)} $</div>`;
          }
          const serialsDisplay = Array.from(item.serials).join(", ");
          const productCell = `
          <div>
            <strong>فاکتور: ${item.id}</strong>
            <div class="muted small">تاریخ: ${item.date ? item.date.split("T")[0] : ""}</div>
            ${productsHtml}
            <div class="muted small" style="font-size:11px;">سریال‌ها: ${serialsDisplay || "-"}</div>
            <button class="btn-link view-invoice" data-invoice-id="${item.id}" style="background:none; border:none; color:#0b74de; text-decoration:underline; cursor:pointer;">مشاهده فاکتور</button>
          </div>
        `;
          const profitValue = (
            typeof item.profit === "number" ? item.profit : 0
          ).toFixed(2);
          let statusBadge = "";
          if (item.discount_amount > 0)
            statusBadge = `<span style="background:#0b5e8a; color:white; padding:2px 6px; border-radius:12px; font-size:11px;">تخفیف: ${Number(item.discount_amount).toFixed(2)} $</span>`;
          else if (item.debt_amount > 0)
            statusBadge = `<span style="background:#b91c1c; color:white; padding:2px 6px; border-radius:12px; font-size:11px;">بدهی: ${Number(item.debt_amount).toFixed(2)} $</span>`;
          return `<tr>
          <td style="text-align:right; padding:8px;">${productCell}</td>
          <td style="text-align:center; padding:8px;">${item.total_qty}</td>
          <td style="text-align:center; padding:8px;">${Number(item.avg_purchase).toFixed(2)}</td>
          <td style="text-align:center; padding:8px;">${Number(item.avg_sale).toFixed(2)}</td>
          <td style="text-align:center; padding:8px;">${Number(item.total_revenue).toFixed(2)}</td>
          <td style="text-align:center; padding:8px; ${profitValue < 0 ? "color:#b91c1c;" : "color:#2c7a4d;"} font-weight:600;">${profitValue}</td>
          <td style="text-align:right; padding:8px;">مشتری: ${item.customer_name} ${statusBadge}</td>
        </tr>`;
        } else {
          const p = DB.data.products.find((p) => p.id === item.productId) || {
            name: "-",
          };
          const serialsDisplay = (item.serials || []).join(", ");
          const statusBadge =
            item.debtAmount > 0
              ? `بدهی: ${Number(item.debtAmount).toFixed(2)} $`
              : item.discountAmount > 0
                ? `تخفیف: ${Number(item.discountAmount).toFixed(2)} $`
                : "";
          const profitValue = (
            typeof item.profit === "number" ? item.profit : 0
          ).toFixed(2);
          const unitPrice =
            item.unitPrice !== null && item.unitPrice !== undefined
              ? Number(item.unitPrice).toFixed(2)
              : "-";
          return `<tr>
          <td style="text-align:right; padding:8px;">
            <div><strong>${p.name}</strong></div>
            <div class="muted small">${item.type} — ${item.date ? item.date.split("T")[0] : ""}</div>
            <div class="muted small">سریال‌ها: ${serialsDisplay || "-"}</div>
           </td>
          <td style="text-align:center;">${item.qty}</td>
          <td style="text-align:center;">${item.type === "in" ? unitPrice : item.profit ? (Number(item.amount) - Number(item.profit)).toFixed(2) : "-"}</td>
          <td style="text-align:center;">${unitPrice}</td>
          <td style="text-align:center;">${Number(item.amount).toFixed(2)}</td>
          <td style="text-align:center; ${profitValue < 0 ? "color:#b91c1c;" : "color:#2c7a4d;"} font-weight:600;">${profitValue}</td>
          <td style="text-align:right;">${item.customer_name || "-"} ${statusBadge}</td>
        </tr>`;
        }
      })
      .join("");

    tbody.innerHTML =
      rowsHtml ||
      `<tr><td colspan="7" style="text-align:center; padding:20px;">موردی یافت نشد</td></tr>`;
    tbody.querySelectorAll(".view-invoice").forEach((btn) => {
      btn.addEventListener("click", () =>
        openInvoiceFromId(btn.getAttribute("data-invoice-id")),
      );
    });
  }

  [
    searchInput,
    typeFilter,
    debtFilter,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    serialSearch,
  ].forEach((el) => {
    if (el) {
      el.addEventListener("input", drawTx);
      el.addEventListener("change", drawTx);
    }
  });
  drawTx();
}
async function showExpenseForm(id) {
  const isEdit = !!id;
  const exp = DB.data.expenses.find((x) => x.id === id) || {
    id: uid("exp"),
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    category: "",
    description: "",
  };

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";
  card.innerHTML = `
    <h3>${isEdit ? "ویرایش مصرف" : "مصرف جدید"}</h3>
    <form id="expForm">
      <label>تاریخ</label>
      <input type="date" name="date" value="${exp.date.split("T")[0]}" required>
      <label>مبلغ (اف)</label>
      <input type="number" name="amount" step="0.01" value="${exp.amount}" required>
      <label>توضیحات</label>
      <textarea name="description">${exp.description || ""}</textarea>

      <label>نوت</label>
      <input name="category" value="${exp.category || ""}">
      
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" type="submit">ذخیره</button>
        <button class="btn ghost" id="cancelExp" type="button">انصراف</button>
      </div>
    </form>
  `;
  mainArea.prepend(card);
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100); // تأخیر ۱۰۰ میلی‌ثانیه برای اطمینان از رندر شدن کامل

  card.querySelector("#cancelExp").onclick = () => card.remove();

  card.querySelector("#expForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const newExp = {
      id: exp.id,
      date: f.date.value,
      amount: Number(f.amount.value),
      category: f.category.value.trim(),
      description: f.description.value.trim(),
    };
    try {
      if (isEdit) {
        await DB.updateExpense(exp.id, newExp);
      } else {
        await DB.createExpense(newExp);
      }
      card.remove();
      renderMain("expenses");
    } catch (err) {
      console.error(err);
      alert("خطا در ذخیره مصرف");
    }
  };
}

async function showTransactionForm(productId = "", type = "in") {
  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";
  card.innerHTML = `
    <h3>ثبت معاملات (${type === "in" ? "ورود" : "خروج"})</h3>
    <form id="txForm">
      <label>📦 کالا </label>
      <select name="productId" required>
        <option value="">انتخاب کنید</option>
        ${DB.data.products.map((p) => `<option value="${p.id}" ${p.id === productId ? "selected" : ""}>${p.name} (${p.sku || "-"})</option>`).join("")}
      </select>

      <label>🏷️تعداد</label>
      <input name="qty" type="number" value="1" required>

      ${
        type === "in"
          ? `
        <div style="margin-top:8px; padding:8px; background:#f9fafc; border-radius:6px;">
          <label>💰 قیمت خرید فی دانه ($)</label>
          <input type="number" name="unit_price" step="0.01" placeholder="مثلاً 12.50" value="0">
          <label>💵 قیمت فروش (پیش‌فرض)($)</label>
          <input type="number" name="default_sale_price" step="0.01" placeholder="مثلاً 15.00">
          <hr style="margin: 8px 0;">
          <label>🧾 مبلغ پرداختی به تأمین‌کننده (کل خرید)</label>
          <input type="number" name="paidToSupplier" step="0.01" value="0">
          <label>⚙️ نحوه محاسبه باقی‌مانده</label>
          <select name="supplierRemainingAction">
          <option value="debt">بدهی به تأمین‌کننده</option>
            <option value="discount">تخفیف دریافتی از تأمین‌کننده</option>
            
          </select>
          <hr style="margin: 8px 0;">

          <label from="fromdece">📝 توضیحات خرید (اختیاری)</label>
          <textarea id="fromdece" name="description" rows="2" style="width:100%;marginTop:1rem;"></textarea>
      
          <label>📎 ضمیمه‌ها (تصاویر فاکتور)</label>
          <div id="attachmentsList" style="margin-bottom:5px;"></div>
          <input type="file" id="attachFiles" accept="image/*" multiple>
          <button type="button" id="addAttachmentsBtn" class="btn small">➕ اضافه کردن تصاویر</button>
          <small class="muted">می‌توانید چندین تصویر فاکتور یا قرارداد را ضمیمه کنید.</small>
        </div>
      `
          : ""
      }

      <label>تامین‌کننده (اختیاری)</label>
      <select name="supplierId">
        <option value="">—</option>
        ${DB.data.suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
      </select>

      <div id="serialSection" style="margin-top:8px;">
        <label>سریال‌ها</label>
        <div style="display:flex; gap:8px; align-items:flex-start;">
          <textarea name="serialsText" rows="3" placeholder="هر سریال در یک خط" style="flex:1;" ${type === "out" ? "readonly" : ""}></textarea>
          ${
            type === "out"
              ? '<button type="button" id="selectSerialsBtn" class="btn small" style="align-self:flex-end;">انتخاب سریال‌های موجود</button>'
              : '<button type="button" id="generateSerialsBtn" class="btn small" style="align-self:flex-end;">تولید سریال‌های تصادفی</button>'
          }
        </div>
        <small class="muted" id="serialHelp"></small>
      </div>

      <label>یادداشت</label>
      <input name="note">

      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" type="submit">ثبت</button>
        <button class="btn ghost" id="cancelTx" type="button">انصراف</button>
      </div>
    </form>
  `;
  mainArea.prepend(card);
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  const form = card.querySelector("#txForm");
  const productSelect = form.querySelector('select[name="productId"]');
  const qtyInput = form.querySelector('input[name="qty"]');
  const unitPriceInput = form.querySelector('input[name="unit_price"]');
  const paidToSupplierInput = form.querySelector(
    'input[name="paidToSupplier"]',
  );
  const serialsTextarea = form.querySelector('textarea[name="serialsText"]');
  const selectBtn = form.querySelector("#selectSerialsBtn");
  const generateBtn = form.querySelector("#generateSerialsBtn");
  const serialHelp = form.querySelector("#serialHelp");

  let attachments = [];

  if (type === "in") {
    function updatePaidToSupplier() {
      const qty = Number(qtyInput.value) || 0;
      const unitPrice = Number(unitPriceInput.value) || 0;
      const totalCost = qty * unitPrice;
      if (paidToSupplierInput) paidToSupplierInput.value = totalCost.toFixed(2);
    }
    qtyInput.addEventListener("input", updatePaidToSupplier);
    unitPriceInput.addEventListener("input", updatePaidToSupplier);
    updatePaidToSupplier();

    const attachBtn = card.querySelector("#addAttachmentsBtn");
    const fileInput = card.querySelector("#attachFiles");
    const attachmentsList = card.querySelector("#attachmentsList");

    attachBtn.addEventListener("click", async () => {
      const files = fileInput.files;
      if (files.length === 0) {
        alert("لطفاً فایل‌ها را انتخاب کنید.");
        return;
      }
      for (const file of files) {
        try {
          const compressed = await compressImage(file, 800, 0.7);
          attachments.push({ filename: file.name, data: compressed });
        } catch (err) {
          console.error(err);
          alert("خطا در فشرده‌سازی تصویر: " + file.name);
        }
      }
      attachmentsList.innerHTML = attachments
        .map((a) => `<div>✅ ${a.filename}</div>`)
        .join("");
      fileInput.value = "";
    });
  }

  let availableSerials = [];

  if (type === "out") {
    async function updateSerialInfo() {
      const pid = productSelect.value;
      if (!pid) {
        serialHelp.innerText = "";
        availableSerials = [];
        return;
      }
      try {
        const serials = await fetchSerials(pid);
        availableSerials = serials.filter(
          (s) =>
            s.status === "available" || s.status === null || s.status === "in",
        );
        if (availableSerials.length > 0) {
          serialHelp.innerText = `${availableSerials.length} سریال موجود است.`;
        } else {
          serialHelp.innerText = "هیچ سریال موجودی برای این کالا یافت نشد.";
        }
      } catch (e) {
        console.error(e);
        serialHelp.innerText = "خطا در دریافت سریال‌ها";
        availableSerials = [];
      }
    }

    productSelect.addEventListener("change", updateSerialInfo);
    if (productSelect.value) updateSerialInfo();

    selectBtn.addEventListener("click", async () => {
      const pid = productSelect.value;
      if (!pid) {
        alert("لطفاً ابتدا یک کالا انتخاب کنید.");
        return;
      }
      const qty = parseInt(qtyInput.value, 10);
      if (isNaN(qty) || qty <= 0) {
        alert("تعداد معتبر وارد کنید.");
        return;
      }
      if (availableSerials.length < qty) {
        alert(`فقط ${availableSerials.length} سریال موجود است.`);
        return;
      }
      showSerialSelector(pid, qty, (selectedSerials) => {
        serialsTextarea.value = selectedSerials.join("\n");
      });
    });
  } else if (type === "in") {
    generateBtn.addEventListener("click", () => {
      const qty = parseInt(qtyInput.value, 10);
      if (isNaN(qty) || qty <= 0) {
        alert("تعداد معتبر وارد کنید.");
        return;
      }
      const generatedSerials = [];
      for (let i = 0; i < qty; i++) {
        generatedSerials.push(uid("ser"));
      }
      serialsTextarea.value = generatedSerials.join("\n");
    });
  }

  card.querySelector("#cancelTx").onclick = () => card.remove();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const qty = Number(f.qty.value || 0);
    const pid = f.productId.value;
    const serialLines = (f.serialsText.value || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (serialLines.length === 0) {
      alert("برای این تراکنش باید سریال وارد کنید.");
      return;
    }

    let finalSerials = serialLines;
    if (type === "in" && serialLines.length === 1 && qty > 1) {
      finalSerials = Array(qty).fill(serialLines[0]);
    } else if (serialLines.length !== qty) {
      alert(
        `تعداد سریال‌ها باید دقیقاً ${qty} باشد. (${serialLines.length} وارد شده)`,
      );
      return;
    }

    let purchasePrice = null;
    let salePrice = null;
    let paidToSupplier = 0;
    let supplierRemainingAction = "discount";
    let description = "";
    if (type === "in") {
      purchasePrice = f.unit_price ? Number(f.unit_price.value) : null;
      salePrice = f.default_sale_price
        ? Number(f.default_sale_price.value)
        : null;
      paidToSupplier = f.paidToSupplier ? Number(f.paidToSupplier.value) : 0;
      supplierRemainingAction = f.supplierRemainingAction.value;
      description = f.description.value || "";
    }

    const tx = {
      id: uid("tx"),
      productId: pid,
      type: type,
      qty: qty,
      supplierId: f.supplierId.value || "",
      note: f.note.value || "",
      description: description,
      date: new Date().toISOString(),
      serialNumbers: finalSerials,
      unit_price: purchasePrice,
      default_sale_price: salePrice,
      paidToSupplier: paidToSupplier,
      supplierRemainingAction: supplierRemainingAction,
      attachments: attachments,
    };

    await DB.createTransaction(tx);
    card.remove();
    renderMain(currentActiveTab);
  };
}

function checkAndNotifyLowStock() {
  try {
    if (!DB || !DB.data || !Array.isArray(DB.data.products)) return;

    const lowList = DB.data.products
      .map((p) => ({
        id: p.id,
        name: p.name,
        minStock: Number(p.minStock || 0),
        location:
          DB.data.locations.find((l) => l.id === p.locationId)?.name || "-",
        stock: getStockForProduct(p.id),
      }))
      .filter((x) => Number(x.stock) < Number(x.minStock));

    console.log("کالاهای زیر حداقل (checkAndNotifyLowStock):", lowList.length);
    console.table(lowList);

    if (
      window.NotificationsAPI &&
      typeof window.NotificationsAPI.showLowStockNotifications === "function"
    ) {
      window.NotificationsAPI.showLowStockNotifications(lowList);
    } else {
      if (typeof setBadgeCount === "function") {
        try {
          setBadgeCount(lowList.length);
        } catch (e) {
          /* ignore */
        }
      }
      console.warn(
        "NotificationsAPI آماده نیست — اعلان‌ها نیمه‌کاره نمایش داده می‌شوند",
      );
    }
  } catch (err) {
    console.error("checkAndNotifyLowStock error:", err);
  }
}

/********** Reports ***********/
async function renderReports() {
  const c = document.createElement("div");

  c.innerHTML = `
    <div class="card_box_header">
      <h3 style="margin:0">گزارشات</h3>
      <div class="select_report" style="display:flex;gap:12px;align-items:center;">
        <select id="reportTypeSelect" style="padding:6px 12px; border-radius:8px;">
          <option value="sales">فروشات</option>
          <option value="inventory">موجودی اجناس</option>
          <option value="customers">مشتریان</option>
        </select>
      </div>
    </div>
    <div id="reportFilters" style="margin-top:12px;"></div>
    <div id="reportContent" style="margin-top:16px;"></div>
  `;
  mainArea.appendChild(c);

  const reportTypeSelect = c.querySelector("#reportTypeSelect");
  const filtersContainer = c.querySelector("#reportFilters");
  const contentContainer = c.querySelector("#reportContent");

  // =========================== گزارش فروشات ===========================
  async function renderSalesReport() {
    filtersContainer.innerHTML = `
      <div class="innerbox_header" style="display:flex;gap:8px;align-items:center; flex-wrap:wrap;  width: fit-content; padding:0.2rem 1rem;border-radius: 2rem; justify-content: center;">
        <input type="date" id="salesStartDate" style="width:140px;">
        <span>تا</span>
        <input type="date" id="salesEndDate" style="width:140px;">
        <select id="salesProductFilter" style="width:160px; padding:6px; border-radius:6px;">
          <option value="all">همه کالاها</option>
        </select>
        <button id="applySalesReport" class="btn small">اعمال</button>
        <button id="printSalesReport" class="btn small"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
</svg>
</button>
      </div>
    `;

    const startDateInput = filtersContainer.querySelector("#salesStartDate");
    const endDateInput = filtersContainer.querySelector("#salesEndDate");
    const productFilter = filtersContainer.querySelector("#salesProductFilter");
    const applyBtn = filtersContainer.querySelector("#applySalesReport");
    const printBtn = filtersContainer.querySelector("#printSalesReport");

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    startDateInput.value = firstDay.toISOString().split("T")[0];
    endDateInput.value = today.toISOString().split("T")[0];

    let reportRows = [];
    let currentStart = startDateInput.value;
    let currentEnd = endDateInput.value;

    async function loadSalesReport() {
      const start = startDateInput.value;
      const end = endDateInput.value;
      if (!start || !end) {
        alert("لطفاً تاریخ شروع و پایان را وارد کنید.");
        return;
      }
      currentStart = start;
      currentEnd = end;
      try {
        const resp = await fetch(
          `${API_BASE}/reports/sales-range?start=${start}&end=${end}`,
        );
        if (!resp.ok) throw new Error("خطا در دریافت گزارش");
        const data = await resp.json();
        reportRows = data.rows || [];

        if (reportRows.length === 0) {
          productFilter.innerHTML = '<option value="all">همه کالاها</option>';
          productFilter.disabled = true;
          contentContainer.innerHTML =
            '<div class="muted" style="padding:12px">هیچ فروشی در این بازه یافت نشد.</div>';
          return;
        }
        productFilter.disabled = false;
        const options = ['<option value="all">همه کالاها</option>'];
        reportRows.forEach((r) =>
          options.push(`<option value="${r.id}">${r.name}</option>`),
        );
        productFilter.innerHTML = options.join("");
        renderSalesTable();
      } catch (err) {
        contentContainer.innerHTML = `<div class="muted" style="padding:12px">خطا: ${err.message}</div>`;
      }
    }

    function renderSalesTable() {
      const selectedProductId = productFilter.value;
      let filteredRows = reportRows;
      let productName = "همه کالاها";
      if (selectedProductId !== "all") {
        filteredRows = reportRows.filter((r) => r.id === selectedProductId);
        const prod = filteredRows[0];
        if (prod) productName = prod.name;
      }
      if (filteredRows.length === 0) {
        contentContainer.innerHTML = `<div class="muted">گزارش فروشات (${currentStart} تا ${currentEnd}) - ${productName}<br>کالایی یافت نشد.</div>`;
        return;
      }

      const totalQty = filteredRows.reduce((s, r) => s + (r.total_qty || 0), 0);
      const totalRevenue = filteredRows.reduce(
        (s, r) => s + (r.total_revenue || 0),
        0,
      );
      const totalCost = filteredRows.reduce(
        (s, r) => s + (r.total_cost || 0),
        0,
      );
      const totalProfit = totalRevenue - totalCost;
      const totalDebt = filteredRows.reduce(
        (s, r) => s + (r.total_debt || 0),
        0,
      );
      const totalDiscount = filteredRows.reduce(
        (s, r) => s + (r.total_discount || 0),
        0,
      );

      // جدول با استایل مناسب
      const html = `
      <div style="margin-bottom:12px;">📊 گزارش فروشات از ${currentStart} تا ${currentEnd} (${productName})</div>
              <div class="innerbox_header" style="font-size: 14px;
    padding: 6px 12px;
    border-radius: 20px;display:flex; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
          <div>📦 تعداد کل فروش: <strong>${totalQty}</strong></div>
          <div>💰 درآمد کل: <strong>${totalRevenue.toFixed(2)}</strong>$</div>
          <div>💸 هزینه کل: <strong>${totalCost.toFixed(2)}</strong> $</div>
          <div>📈 سود کل: <strong>${totalProfit.toFixed(2)}</strong> $</div>
          <div>⚠️ بدهی بالای مشتری: <strong>${totalDebt.toFixed(2)}</strong> $</div>
          <div>🏷️ تخفیف‌ها: <strong>${totalDiscount.toFixed(2)}</strong> $</div>
        </div>
        

        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
          <thead>
            <tr style="background:#f5f6f8;">
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">جنس</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">تعداد</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">درآمد ($)</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">هزینه ($)</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">سود ($)</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">بدهی ($)</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:center;">تخفیف ($)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRows
              .map(
                (r) => `
              <tr>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${r.name}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${(r.total_qty || 0).toFixed(0)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${(r.total_revenue || 0).toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${(r.total_cost || 0).toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${(r.total_profit || 0).toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center; color:#b91c1c;">${(r.total_debt || 0).toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center; color:#0b5e8a;">${(r.total_discount || 0).toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
      contentContainer.innerHTML = html;

      // دکمه پرینت با طراحی زیبا
      printBtn.onclick = () => {
        const rowsPrint = filteredRows
          .map(
            (r) => `
          <tr>
            <td style="border:1px solid #ddd; padding:8px;">${r.name}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${(r.total_qty || 0).toFixed(0)}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${(r.total_revenue || 0).toFixed(2)} $</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${(r.total_cost || 0).toFixed(2)} $</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${(r.total_profit || 0).toFixed(2)} $</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center; color:#b91c1c;">${(r.total_debt || 0).toFixed(2)} $</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center; color:#0b5e8a;">${(r.total_discount || 0).toFixed(2)} $</td>
          </tr>
          `,
          )
          .join("");

        const printWindow = window.open("", "_blank");
        printWindow.document.write(
          printTemplate(
            "گزارش فروشات",
            `
          <div class="report-info">
            <div><strong>بازه زمانی:</strong> ${currentStart} تا ${currentEnd}</div>
            <div><strong>کالا:</strong> ${productName}</div>
            <div><strong>تاریخ چاپ:</strong> ${new Date().toLocaleDateString("fa-IR")}</div>
          </div>
          <div class="summary-cards">
            <div class="card"><div class="label">📦 تعداد کل فروش</div><div class="value">${totalQty}</div></div>
            <div class="card"><div class="label">💰 درآمد کل</div><div class="value">${totalRevenue.toFixed(2)} $</div></div>
            <div class="card"><div class="label">💸 هزینه کل</div><div class="value">${totalCost.toFixed(2)} $</div></div>
            <div class="card"><div class="label">📈 سود کل</div><div class="value">${totalProfit.toFixed(2)} $</div></div>
            <div class="card debt"><div class="label">⚠️ بدهی بالای مشتری</div><div class="value">${totalDebt.toFixed(2)} $</div></div>
            <div class="card discount"><div class="label">🏷️ تخفیف‌ها</div><div class="value">${totalDiscount.toFixed(2)} $</div></div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th>جنس</th><th>تعداد</th><th>درآمد ($)</th><th>هزینه ($)</th><th>سود ($)</th><th>بدهی ($)</th><th>تخفیف ($)</th></tr></thead>
            <tbody>${rowsPrint}</tbody>
          </table>
        `,
          ),
        );
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      };
    }

    applyBtn.addEventListener("click", loadSalesReport);
    productFilter.addEventListener("change", renderSalesTable);
    await loadSalesReport();
  }

  // =========================== گزارش موجودی اجناس ===========================
  function renderInventoryReport() {
    filtersContainer.innerHTML = `
      <div class="innerbox_header" style="display:flex;gap:8px;align-items:center; flex-wrap:wrap;  width: fit-content; padding:0.2rem 1rem;border-radius: 2rem; justify-content: center;">
        <input type="text" id="invSearch" placeholder="نام کالا ..." style="width:200px;">
        <select id="invCategory" style="width:160px;"><option value="">همه دسته‌ها</option></select>
        <button id="applyInventoryFilter" class="btn small">اعمال</button>
        <button id="printInventoryReport" class="btn small"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
</svg>
</button>
      </div>
    `;

    const searchInput = filtersContainer.querySelector("#invSearch");
    const categorySelect = filtersContainer.querySelector("#invCategory");
    const applyBtn = filtersContainer.querySelector("#applyInventoryFilter");
    const printBtn = filtersContainer.querySelector("#printInventoryReport");

    const categories = [
      ...new Set(DB.data.products.map((p) => p.category).filter((c) => c)),
    ];
    categorySelect.innerHTML =
      '<option value="">همه دسته‌ها</option>' +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");

    function renderInventoryTable() {
      const searchText = searchInput.value.trim().toLowerCase();
      const selectedCategory = categorySelect.value;
      let products = DB.data.products.filter((p) => {
        if (
          searchText &&
          !p.name.toLowerCase().includes(searchText) &&
          !(p.sku || "").toLowerCase().includes(searchText)
        )
          return false;
        if (selectedCategory && p.category !== selectedCategory) return false;
        return true;
      });

      const stockData = products
        .map((p) => {
          const stock = getStockForProduct(p.id);
          let totalPurchaseValue = 0,
            totalSaleValue = 0;
          if (DB.data.serials) {
            const productSerials = DB.data.serials.filter(
              (s) =>
                s.product_id === p.id &&
                (s.status === "available" ||
                  s.status === "in" ||
                  s.status === null),
            );
            for (const s of productSerials) {
              if (s.purchase_price)
                totalPurchaseValue += Number(s.purchase_price);
              if (s.sale_price) totalSaleValue += Number(s.sale_price);
            }
          } else {
            if (p.defaultPurchasePrice)
              totalPurchaseValue = p.defaultPurchasePrice * stock;
            if (p.defaultSalePrice) totalSaleValue = p.defaultSalePrice * stock;
          }
          return {
            name: p.name,
            sku: p.sku,
            category: p.category,
            stock,
            totalPurchaseValue,
            totalSaleValue,
            avgPurchase: stock > 0 ? totalPurchaseValue / stock : 0,
            avgSale: stock > 0 ? totalSaleValue / stock : 0,
          };
        })
        .filter((item) => item.stock > 0 || item.totalPurchaseValue > 0);

      let title = "📊 گزارش موجودی اجناس";
      if (searchText) title += ` (جستجو: ${searchText})`;
      if (selectedCategory) title += ` - دسته: ${selectedCategory}`;

      const totalStockValue = stockData.reduce(
        (s, i) => s + i.totalPurchaseValue,
        0,
      );
      const totalPotentialRevenue = stockData.reduce(
        (s, i) => s + i.totalSaleValue,
        0,
      );

      if (stockData.length === 0) {
        contentContainer.innerHTML = `<div class="muted">${title}<br>هیچ کالایی یافت نشد.</div>`;
        return;
      }

      const html = `
        <div style="margin-bottom:12px;">${title}</div>
        <div class="innerbox_header"  style="font-size: 14px;
    padding: 6px 12px;
    border-radius: 20px;margin-bottom:16px;   display: flex;
  height: fit-content;
  width: fit-content;
  align-items: center;
  justify-content:center; gap:1rem"><span>💰 ارزش کل موجودی (بر اساس قیمت خرید): <strong>${totalStockValue.toFixed(2)}</strong> $ &nbsp;</span> | <span>&nbsp;
        💵 ارزش فروش کل (بر اساس قیمت فروش): <strong>${totalPotentialRevenue.toFixed(2)}</strong> $</span></div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
          <thead><tr style="background:#f5f6f8;">
            <th style="border:1px solid #ddd; padding:8px;">کالا</th>
            <th style="border:1px solid #ddd; padding:8px;">دسته</th>
            <th style="border:1px solid #ddd; padding:8px;">موجودی</th>
            <th style="border:1px solid #ddd; padding:8px;">ارزش خرید ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">ارزش فروش ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">میانگین خرید ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">میانگین فروش ($)</th>
          </tr></thead>
          <tbody>
            ${stockData
              .map(
                (i) => `
              <tr>
                <td style="border:1px solid #ddd; padding:6px;">${i.name} (${i.sku || "-"})</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.category || "-"}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.stock}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.totalPurchaseValue.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.totalSaleValue.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.avgPurchase.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.avgSale.toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
      contentContainer.innerHTML = html;

      printBtn.onclick = () => {
        const rowsPrint = stockData
          .map(
            (i) => `
          <tr>
            <td style="border:1px solid #ddd; padding:8px;">${i.name} (${i.sku || "-"})</td>
            <td style="padding:8px; text-align:center;">${i.category || "-"}</td>
            <td style="padding:8px; text-align:center;">${i.stock}</td>
            <td style="padding:8px; text-align:center;">${i.totalPurchaseValue.toFixed(2)} $</td>
            <td style="padding:8px; text-align:center;">${i.totalSaleValue.toFixed(2)} $</td>
            <td style="padding:8px; text-align:center;">${i.avgPurchase.toFixed(2)}</td>
            <td style="padding:8px; text-align:center;">${i.avgSale.toFixed(2)}</td>
          </tr>
          `,
          )
          .join("");

        const printWindow = window.open("", "_blank");
        printWindow.document.write(
          printTemplate(
            "گزارش موجودی اجناس",
            `
          <div class="report-info">
            <div><strong>فیلترها:</strong> ${searchText ? `نام: ${searchText}` : "همه کالاها"} ${selectedCategory ? ` | دسته: ${selectedCategory}` : ""}</div>
            <div><strong>تاریخ چاپ:</strong> ${new Date().toLocaleDateString("fa-IR")}</div>
          </div>
          <div class="summary-cards">
            <div class="card"><div class="label">💰 ارزش کل موجودی (خرید)</div><div class="value">${totalStockValue.toFixed(2)} $</div></div>
            <div class="card"><div class="label">💵 ارزش فروش کل</div><div class="value">${totalPotentialRevenue.toFixed(2)} $</div></div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th>کالا</th><th>دسته</th><th>موجودی</th><th>ارزش خرید ($)</th><th>ارزش فروش ($)</th><th>میانگین خرید ($)</th><th>میانگین فروش ($)</th></tr></thead>
            <tbody>${rowsPrint}</tbody>
          </table>
        `,
          ),
        );
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      };
    }

    applyBtn.addEventListener("click", renderInventoryTable);
    renderInventoryTable();
  }

  // =========================== گزارش مشتریان ===========================
  async function renderCustomerReport() {
    filtersContainer.innerHTML = `
      <div class="innerbox_header" style="display:flex;gap:8px;align-items:center; flex-wrap:wrap;  width: fit-content; padding:0.2rem 1rem;border-radius: 2rem; justify-content: center;">
        <input type="text" id="custSearch" placeholder=" مشتری ..." style="width:200px;">
        <input type="date" id="custStartDate" placeholder="از تاریخ">
        <span>تا</span>
        <input type="date" id="custEndDate" placeholder="تا تاریخ">
        <select id="custRemainingFilter" style="width:120px;">
          <option value="all">همه</option>
          <option value="debt">فقط بدهی</option>
          <option value="discount">فقط تخفیف</option>
        </select>
        <button id="applyCustomerFilter" class="btn small">اعمال</button>
        <button id="printCustomerReport" class="btn small"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
</svg>
</button>
      </div>
    `;

    const searchInput = filtersContainer.querySelector("#custSearch");
    const startDateInput = filtersContainer.querySelector("#custStartDate");
    const endDateInput = filtersContainer.querySelector("#custEndDate");
    const remainingFilter = filtersContainer.querySelector(
      "#custRemainingFilter",
    );
    const applyBtn = filtersContainer.querySelector("#applyCustomerFilter");
    const printBtn = filtersContainer.querySelector("#printCustomerReport");

    function renderCustomerTable() {
      const searchText = searchInput.value.trim().toLowerCase();
      const startDate = startDateInput.value
        ? new Date(startDateInput.value)
        : null;
      let endDate = endDateInput.value ? new Date(endDateInput.value) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);
      const remainingType = remainingFilter.value;

      let customers = DB.data.customers.filter(
        (c) => !searchText || c.name.toLowerCase().includes(searchText),
      );
      const invoices = DB.data.invoices;

      let customerData = customers
        .map((c) => {
          let customerInvoices = invoices.filter(
            (inv) => inv.customer_id === c.id,
          );
          if (startDate || endDate) {
            customerInvoices = customerInvoices.filter((inv) => {
              const invDate = new Date(inv.date);
              if (startDate && invDate < startDate) return false;
              if (endDate && invDate > endDate) return false;
              return true;
            });
          }
          let totalPurchases = 0,
            totalPaid = 0,
            totalDebt = 0,
            totalDiscount = 0;
          for (const inv of customerInvoices) {
            const total = Number(inv.total) || 0;
            const paid = Number(inv.paid_amount) || 0;
            totalPurchases += total;
            totalPaid += paid;
            const remaining = total - paid;
            if (remaining > 0) {
              if (inv.remaining_action === "debt") totalDebt += remaining;
              else totalDiscount += remaining;
            }
          }
          const remainingTotal = totalPurchases - totalPaid;
          return {
            name: c.name,
            contact: c.contact,
            totalPurchases,
            totalPaid,
            remainingTotal,
            totalDebt,
            totalDiscount,
            invoiceCount: customerInvoices.length,
          };
        })
        .filter((c) => c.totalPurchases > 0 || c.invoiceCount > 0);

      if (remainingType === "debt")
        customerData = customerData.filter((c) => c.totalDebt > 0);
      else if (remainingType === "discount")
        customerData = customerData.filter((c) => c.totalDiscount > 0);

      let title = "📊 گزارش مشتریان";
      if (searchText) title += ` (جستجو: ${searchText})`;
      if (startDateInput.value || endDateInput.value) {
        const from = startDateInput.value || "ابتدا";
        const to = endDateInput.value || "امروز";
        title += ` - بازه فاکتورها: ${from} تا ${to}`;
      }
      if (remainingType === "debt") title += " - فقط بدهی";
      else if (remainingType === "discount") title += " - فقط تخفیف";

      if (customerData.length === 0) {
        contentContainer.innerHTML = `<div class="muted">${title}<br>هیچ مشتری با این فیلترها یافت نشد.</div>`;
        return;
      }

      const html = `
        <div style="margin-bottom:12px;">${title}</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
          <thead><tr style="background:#f5f6f8;">
            <th style="border:1px solid #ddd; padding:8px;">مشتری</th>
            <th style="border:1px solid #ddd; padding:8px;">تعداد فاکتور</th>
            <th style="border:1px solid #ddd; padding:8px;">جمع خرید ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">پرداخت شده ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">باقی‌مانده ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">بدهی ($)</th>
            <th style="border:1px solid #ddd; padding:8px;">تخفیف ($)</th>
          </tr></thead>
          <tbody>
            ${customerData
              .map(
                (c) => `
              <tr>
                <td style="border:1px solid #ddd; padding:6px;">${c.name}<div class="muted small">${c.contact || ""}</div></td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${c.invoiceCount}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${c.totalPurchases.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${c.totalPaid.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center;">${c.remainingTotal.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center; color:#b91c1c;">${c.totalDebt.toFixed(2)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:center; color:#0b5e8a;">${c.totalDiscount.toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
      contentContainer.innerHTML = html;

      printBtn.onclick = () => {
        const rowsPrint = customerData
          .map(
            (c) => `
          <tr>
            <td style="border:1px solid #ddd; padding:8px;">${c.name}<br><small>${c.contact || ""}</small></td>
            <td style="padding:8px; text-align:center;">${c.invoiceCount}</td>
            <td style="padding:8px; text-align:center;">${c.totalPurchases.toFixed(2)} $</td>
            <td style="padding:8px; text-align:center;">${c.totalPaid.toFixed(2)} $</td>
            <td style="padding:8px; text-align:center;">${c.remainingTotal.toFixed(2)} $</td>
            <td style="padding:8px; text-align:center; color:#b91c1c;">${c.totalDebt.toFixed(2)} $</td>
            <td style="padding:8px; text-align:center; color:#0b5e8a;">${c.totalDiscount.toFixed(2)} $</td>
          </tr>
          `,
          )
          .join("");

        const filterText = [];
        if (searchText) filterText.push(`نام: ${searchText}`);
        if (startDateInput.value || endDateInput.value)
          filterText.push(
            `بازه: ${startDateInput.value || "ابتدا"} تا ${endDateInput.value || "امروز"}`,
          );
        if (remainingType !== "all")
          filterText.push(remainingType === "debt" ? "فقط بدهی" : "فقط تخفیف");

        const printWindow = window.open("", "_blank");
        printWindow.document.write(
          printTemplate(
            "گزارش مشتریان",
            `
          <div class="report-info">
            <div><strong>فیلترها:</strong> ${filterText.length ? filterText.join(" | ") : "همه مشتریان"}</div>
            <div><strong>تاریخ چاپ:</strong> ${new Date().toLocaleDateString("fa-IR")}</div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th>مشتری</th><th>تعداد فاکتور</th><th>جمع خرید ($)</th><th>پرداخت شده ($)</th><th>باقی‌مانده ($)</th><th>بدهی ($)</th><th>تخفیف ($)</th></tr></thead>
            <tbody>${rowsPrint}</tbody>
          </table>
        `,
          ),
        );
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      };
    }

    applyBtn.addEventListener("click", renderCustomerTable);
    renderCustomerTable();
  }

  // =========================== تابع کمکی قالب چاپ ===========================
  function printTemplate(title, contentHtml) {
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Vazirmatn', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #fff;
          padding: 0;
          margin: 0;
        }
        .print-container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #0b3b5f 0%, #1a5f7a 100%);
          color: white;
          padding: 20px 25px;
          text-align: center;
        }
        .header h1 { font-size: 1.8rem; margin-bottom: 5px; }
        .header p { opacity: 0.9; font-size: 0.85rem; }
        .report-info {
          padding: 15px 25px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .summary-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          padding: 20px 25px;
          background: #ffffff;
          border-bottom: 1px solid #eef2f6;
        }
        .card {
          background: #f9fafc;
          border-radius: 16px;
          padding: 12px 20px;
          flex: 1;
          min-width: 140px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .card .label { font-size: 0.8rem; color: #5b6e8c; margin-bottom: 6px; }
        .card .value { font-size: 1.5rem; font-weight: 700; color: #0b3b5f; }
        .card.debt .value { color: #b91c1c; }
        .card.discount .value { color: #0b5e8a; }
        /* اصلاح جدول برای چاپ */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        th {
          background: #f1f5f9;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          font-size: 0.75rem;
          color: #6c757d;
          padding: 15px;
          border-top: 1px solid #e2e8f0;
          margin-top: 10px;
        }
        /* برای چاپ، حاشیه‌های اضافی حذف شود */
        @media print {
          body {
            padding: 0;
            margin: 0;
          }
          .print-container {
            box-shadow: none;
            border-radius: 0;
            margin: 0;
            width: 100%;
          }
          .header, .report-info, .summary-cards, .footer {
            padding-left: 0;
            padding-right: 0;
          }
          table {
            margin: 10px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        <div class="header">
          <h1>📊 ${title}</h1>
          <p>شرکت تجارتی دفاری لمیتد | سیستم مدیریت انبار و فروش</p>
        </div>
        ${contentHtml}
        <div class="footer">
          این گزارش به صورت سیستمی تهیه شده و نیازی به امضا ندارد. | fahimullahkamal@gmail.com 0782271752 لایت - نرم‌افزار مدیریت فروش
        </div>
      </div>
    </body>
    </html>
  `;
  }

  // =========================== تغییر نوع گزارش ===========================
  reportTypeSelect.addEventListener("change", async () => {
    const type = reportTypeSelect.value;
    if (type === "sales") await renderSalesReport();
    else if (type === "inventory") renderInventoryReport();
    else if (type === "customers") await renderCustomerReport();
  });
  await renderSalesReport();
}

/********** Utilities: export / import / seed / clear ***********/
document.getElementById("exportJson").onclick = async () => {
  try {
    const data = await DB.exportJson();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "warehouse-export.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("خطا در گرفتن export از سرور");
  }
};

document.getElementById("exportCsv").onclick = () => {
  const rows = [["sku", "name", "category", "location", "stock"]];
  DB.data.products.forEach((p) => {
    const loc =
      DB.data.locations.find((l) => l.id === p.locationId)?.name || "";
    rows.push([p.sku, p.name, p.category || "", loc, getStockForProduct(p.id)]);
  });
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products-stock.csv";
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById("importJson").onclick = () => {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        await DB.importJson(parsed);
        alert("داده‌ها بارگذاری شد روی سرور");
        await DB.load();
        renderMain("products");
        refreshFilterLocations();
      } catch (err) {
        console.error(err);
        alert("فایل JSON معتبر نیست یا واردسازی شکست خورد");
      }
    };
    reader.readAsText(f);
  };
  inp.click();
};

document.getElementById("seedData").onclick = async () => {
  if (!confirm("افزودن داده نمونه به دیتابیس — ادامه؟")) return;
  const locations = [
    { id: uid("loc"), name: "قفسه A1" },
    { id: uid("loc"), name: "قفسه B2" },
  ];
  const suppliers = [
    { id: uid("sup"), name: "شرکت تامین‌کننده الف", contact: "0912-xxx" },
  ];
  const products = [
    {
      id: uid("prod"),
      sku: "P-001",
      name: "پیچ 4mm",
      category: "مصالح",
      locationId: locations[0].id,
      minStock: 10,
    },
    {
      id: uid("prod"),
      sku: "P-002",
      name: "واشر 6mm",
      category: "مصالح",
      locationId: locations[1].id,
      minStock: 5,
    },
  ];
  const transactions = [
    {
      id: uid("tx"),
      productId: products[0].id,
      type: "in",
      qty: 100,
      date: new Date().toISOString(),
      note: "بار اول",
      supplierId: suppliers[0].id,
    },
    {
      id: uid("tx"),
      productId: products[1].id,
      type: "in",
      qty: 60,
      date: new Date().toISOString(),
      note: "بار اول",
      supplierId: suppliers[0].id,
    },
  ];
  try {
    await DB.importJson({ products, suppliers, locations, transactions });
    alert("نمونه داده افزوده شد به سرور");
    await DB.load();
    renderMain("products");
    refreshFilterLocations();
  } catch (err) {
    console.error(err);
    alert("افزودن نمونه داده شکست خورد");
  }
};

document.getElementById("clearData").onclick = async () => {
  if (!confirm("آیا از پاک کردن تمام داده‌ها مطمئن هستید؟")) return;
  try {
    await DB.reset();
    alert("داده‌ها پاک شدند");
    await DB.load();
    renderMain("products");
    refreshFilterLocations();
  } catch (err) {
    console.error(err);
    alert("پاکسازی شکست خورد");
  }
};

document.getElementById("receiveNow").onclick = () =>
  showTransactionForm("", "in");
document.getElementById("shipNow").onclick = () =>
  showTransactionForm("", "out");

function itemRequiresSerial(item) {
  if (!item) return false;
  if (item.requires_serial || item.track_serials || item.hasSerials)
    return true;
  try {
    if (window.DB && window.DB.data && Array.isArray(window.DB.data.products)) {
      const pid = item.product_id || item.productId || item.product || item.id;
      const prod = window.DB.data.products.find(
        (p) => String(p.id) === String(pid),
      );
      if (prod)
        return !!(
          prod.track_serials ||
          prod.requires_serial ||
          prod.manage_serials
        );
    }
  } catch (err) {}
  return false;
}

// --- UI: render modal body for items needing serial ---
function renderSerialModalBody(itemsNeeding) {
  const body = document.getElementById("serialModalBody");
  body.innerHTML = "";

  if (!itemsNeeding.length) {
    body.innerHTML =
      '<div style="padding:18px;color:#6b7280">کالایی برای انتخاب سریال نیاز ندارد.</div>';
    return;
  }

  itemsNeeding.forEach((it, idx) => {
    const pid = it.product_id || it.productId || it.product;
    const title =
      it.product_name ||
      it.productName ||
      it.product ||
      `کالا ${pid || idx + 1}`;
    const qty = Number(it.qty || it.quantity || it.count || 1);

    const avail = getAvailableSerialsFromDB(pid);
    const availCount = avail.length;

    const container = document.createElement("div");
    container.style =
      "border:1px solid #eee;padding:10px;border-radius:8px;margin-bottom:10px;";

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div>
          <strong>${title}</strong> <span style="color:#6b7280;font-size:13px"> (تعداد: ${qty})</span>
          <div style="color:#6b7280;font-size:12px;margin-top:4px">موجود: ${availCount} سریال</div>
        </div>
        <div style="text-align:left">
          <input data-search-for="${pid}" placeholder="جستجوی سریال..." style="padding:6px 10px;border-radius:8px;border:1px solid #ddd;width:220px">
        </div>
      </div>
      <div id="serialList_${pid}" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      <div style="color:#b91c1c;font-size:13px;margin-top:6px" id="serialError_${pid}"></div>
    `;

    body.appendChild(container);

    const listDiv = container.querySelector(`#serialList_${pid}`);
    const searchInput = container.querySelector(
      `input[data-search-for="${pid}"]`,
    );
    const errorDiv = container.querySelector(`#serialError_${pid}`);

    function renderList(filter = "") {
      listDiv.innerHTML = "";
      const filtered = avail.filter((s) =>
        String(s.serial || s.code || s.id)
          .toLowerCase()
          .includes(filter.toLowerCase()),
      );
      if (!filtered.length) {
        listDiv.innerHTML = `<div style="padding:8px;color:#6b7280">سریالی برای نمایش نیست</div>`;
        return;
      }
      filtered.forEach((s) => {
        const serialVal = s.serial || s.code || s.id || "";
        const itemWrap = document.createElement("label");
        itemWrap.style =
          "display:inline-flex;align-items:center;gap:8px;border:1px solid #eef;padding:6px 8px;border-radius:6px;cursor:pointer";
        itemWrap.innerHTML = `<input type="checkbox" data-pid="${pid}" data-serial="${escapeHtml(serialVal)}"> <span style="font-size:13px">${escapeHtml(serialVal)}</span>`;
        listDiv.appendChild(itemWrap);
      });
    }

    renderList();

    searchInput.addEventListener("input", (e) => {
      renderList(e.target.value || "");
    });

    container.getSelectedSerials = () => {
      const checks = Array.from(
        listDiv.querySelectorAll("input[type=checkbox]"),
      );
      return checks
        .filter((c) => c.checked)
        .map((c) => c.getAttribute("data-serial"));
    };

    container._meta = { pid, qty, errorDiv, availCount };
    container.dataset.pid = pid;
  });
}

// --- show modal and return a promise with selected serials map ---
function showSerialSelectionModal(items) {
  const itemsNeeding = items.filter(itemRequiresSerial);
  return new Promise((resolve, reject) => {
    const modal = document.getElementById("serialModal");
    const closeBtn = document.getElementById("serialModalClose");
    const cancelBtn = document.getElementById("serialModalCancel");
    const confirmBtn = document.getElementById("serialModalConfirm");

    renderSerialModalBody(itemsNeeding);

    function cleanup() {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      closeBtn.removeEventListener("click", onCancel);
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
    }

    function onCancel() {
      cleanup();
      reject(new Error("user_cancel"));
    }

    function onConfirm() {
      const body = document.getElementById("serialModalBody");
      const selectedMap = {};
      let ok = true;

      Array.from(body.children).forEach((block) => {
        const pid = block.dataset.pid || (block._meta && block._meta.pid);
        if (!pid) return;
        const checks = Array.from(
          block.querySelectorAll("input[type=checkbox]"),
        );
        const selected = checks
          .filter((c) => c.checked)
          .map((c) => c.getAttribute("data-serial"));
        const qty = Number(
          (block._meta && block._meta.qty) || (block.querySelector && 1),
        );
        const errorDiv = block._meta && block._meta.errorDiv;
        if ((selected || []).length !== qty) {
          ok = false;
          if (errorDiv)
            errorDiv.textContent = `خطا: تعداد سریال انتخاب‌شده باید دقیقاً ${qty} باشد.`;
          block.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          if (errorDiv) errorDiv.textContent = "";
        }
        selectedMap[pid] = selected;
      });

      if (!ok) return;

      cleanup();
      resolve(selectedMap);
    }

    closeBtn.addEventListener("click", onCancel);
    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);

    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    const firstInput = modal.querySelector("input");
    if (firstInput) firstInput.focus();
  });
}

// filter location select populate
// اصلاح تابع refreshFilterLocations (در پایین فایل)
function refreshFilterLocations() {
  const sel = document.getElementById("filterLocation");
  if (sel) {
    sel.innerHTML =
      '<option value="">همه</option>' +
      DB.data.locations
        .map((l) => `<option value="${l.id}">${l.name}</option>`)
        .join("");
  }
}

// keyboard shortcuts (برای راحتی توسعه/تست)
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.key === "n") renderMain("products");
});

// initial load from server and render UI
DB.load()
  .then(() => {
    renderTabs();
    renderMain("products");

    try {
      checkAndNotifyLowStock();
    } catch (e) {
      console.error(e);
    }
  })
  .catch((err) => {
    console.error("DB.load failed", err);
    alert(
      "خطا در بارگذاری داده‌ها از سرور — بررسی کن سرور ران باشد و API_BASE صحیح باشد.",
    );
  });

/* Mutation observer fallback: whenever product rows are added with data-product-id, attach serial summary */
(function () {
  const attachToExisting = () => {
    document
      .querySelectorAll("[data-product-id], [data-productid], .product-row")
      .forEach((el) => {
        const pid =
          el.dataset.productId ||
          el.dataset.productid ||
          (el.getAttribute && el.getAttribute("data-product-id"));
        if (pid) {
          if (!el.__serials_attached) {
            attachSerialsSummary(el, pid);
            el.__serials_attached = true;
          }
        }
      });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachToExisting);
  } else attachToExisting();

  const mo = new MutationObserver((muts) => {
    attachToExisting();
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

/* Hook into invoice item add: when a product qty is selected, if product has serials, show selector to pick exact serials. */
(function () {
  document.body.addEventListener("click", async (ev) => {
    const t =
      ev.target.closest &&
      ev.target.closest('[data-action="add-to-invoice"], .add-to-invoice');
    if (!t) return;
    ev.preventDefault();
    let pid =
      t.dataset.productId || t.getAttribute("data-product-id") || t.dataset.pid;
    if (!pid) {
      const p = t.getAttribute("data-product") || null;
      if (p) pid = p;
    }
    let qty = 1;
    const qinput =
      t.closest(".product-row") &&
      t.closest(".product-row").querySelector(".qty-input");
    if (qinput) qty = Number(qinput.value || qinput.textContent || 1);
    else {
      const qPrompt = prompt("تعداد برای فروش را وارد کنید:", "1");
      qty = Number(qPrompt || 1);
    }
    if (!pid || isNaN(qty) || qty <= 0)
      return alert("شناسه محصول یا تعداد معتبر نیست.");

    const serials = await fetchSerials(pid);
    const avail = serials.filter(
      (s) => s.status === "available" || s.status === null || s.status === "in",
    );
    if (avail.length === 0) {
      if (
        !confirm(
          "برای این محصول سریالی ثبت نشده یا همه فروخته شده. آیا باز هم می‌خواهید کالارا بدون انتخاب سریال اضافه کنید؟",
        )
      )
        return;
    } else if (avail.length < qty) {
      if (
        !confirm(
          `تنها ${avail.length} عدد سریال موجود است، ولی شما ${qty} خواسته‌اید. آیا ادامه دهیم؟`,
        )
      )
        return;
    }

    if (avail.length >= qty) {
      showSerialSelector(pid, qty, (selectedSerials) => {
        const e = new CustomEvent("invoice:add-item", {
          detail: { productId: pid, qty: qty, serialNumbers: selectedSerials },
          bubbles: true,
          cancelable: true,
        });
        t.dispatchEvent(e);
      });
    } else {
      const e = new CustomEvent("invoice:add-item", {
        detail: { productId: pid, qty: qty, serialNumbers: [] },
        bubbles: true,
        cancelable: true,
      });
      t.dispatchEvent(e);
    }
  });

  document.body.addEventListener("invoice:add-item", (ev) => {
    const d = ev.detail || {};
    if (typeof addInvoiceItemUI === "function") {
      addInvoiceItemUI(d.productId, d.qty, d.serialNumbers);
    } else {
      window.invoiceDraft = window.invoiceDraft || [];
      window.invoiceDraft.push({
        productId: d.productId,
        qty: d.qty,
        serialNumbers: d.serialNumbers,
      });
      console.log("invoiceDraft updated", window.invoiceDraft);
      alert(
        "آیتم به پیش‌فاکتور اضافه شد (ممکن است نیاز به ذخیره صفحه داشته باشید).",
      );
    }
  });
})();

// -------------------------
// Serial helpers for invoice submission
// -------------------------

function getAvailableSerialsFromDB(productId) {
  try {
    if (!window.DB || !window.DB.data) return [];
    const all = Array.isArray(window.DB.data.serials)
      ? window.DB.data.serials
      : [];
    return all.filter((s) => {
      const pid = s.product_id || s.productId || s.product;
      const status = (s.status || s.state || "").toString().toLowerCase();
      return (
        String(pid) === String(productId) &&
        (!status ||
          status === "available" ||
          status === "in_stock" ||
          status === "in stock")
      );
    });
  } catch (err) {
    console.error("getAvailableSerialsFromDB error", err);
    return [];
  }
}

// Note: itemRequiresSerial already defined above, so we don't redefine it.

function escapeHtmlSimple(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// (Optional) fallback modal creation if not present in HTML
if (!document.getElementById("serialModal")) {
  const modalHtml = `
    <div id="serialModal" style="display:none">
      <div id="serialModalBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998"></div>
      <div id="serialModalContent" style="position:fixed;right:50%;top:50%;transform:translate(50%,-50%);width:900px;max-width:96%;background:#fff;border-radius:8px;padding:12px;z-index:9999;direction:rtl">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong>انتخاب سریال‌ها</strong>
          <button id="serialModalClose" style="background:none;border:0;cursor:pointer">✕</button>
        </div>
        <div id="serialModalBody" style="max-height:420px;overflow:auto;padding:6px"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button id="serialModalCancel" style="padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">انصراف</button>
          <button id="serialModalConfirm" style="padding:8px 14px;border-radius:6px;border:0;background:#0b74de;color:#fff;cursor:pointer">تایید</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}
function updateMobileNavActive() {
  const activeTab = currentActiveTab;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.getAttribute("data-tab") === activeTab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}
// بعد از تعریف renderMain، این تابع را اضافه کنید
function initMobileNav() {
  const navBtns = document.querySelectorAll(".nav-btn");
  if (!navBtns.length) return;

  function setActiveButton(tabId) {
    navBtns.forEach((btn) => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (!tabId) return;
      // تغییر تب اصلی (همان کاری که قبلاً انجام می‌دادید)
      renderMain(tabId);
      // به‌روزرسانی کلاس active
      setActiveButton(tabId);
      // (اختیاری) اسکرول به بالا
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // در ابتدا دکمه متناسب با تب فعلی را فعال کنید
  const currentTab = currentActiveTab || "products";
  setActiveButton(currentTab);
}
// نمایش تصویر در اندازه بزرگ (modal)
function showLargeImage(imageSrc) {
  let modal = document.getElementById("imageModal");

  // اگر modal وجود ندارد، آن را بساز
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "imageModal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0,0,0,0.8)";
    modal.style.display = "none";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "10000";
    modal.style.cursor = "pointer";

    // با کلیک روی هر جای modal، آن را ببند
    modal.onclick = function () {
      modal.style.display = "none";
    };

    const img = document.createElement("img");
    img.id = "largeImage";
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    img.style.objectFit = "contain";
    img.style.borderRadius = "8px";
    modal.appendChild(img);

    document.body.appendChild(modal);
  }

  // تصویر را به‌روز کرده و modal را نمایش بده
  const largeImg = document.getElementById("largeImage");
  largeImg.src = imageSrc;
  modal.style.display = "flex";
}
// صدا زدن تابع بعد از بارگذاری اولیه
DB.load()
  .then(() => {
    renderTabs();
    renderMain("products");
    initMobileNav(); // اضافه کنید
    checkAndNotifyLowStock();
  })
  .catch();

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  const res = await fetch("/api/logout", { method: "POST" });
  if (res.ok) {
    window.location.href = "/login";
  }
});

function updateProfileMenu() {
  const usernameSpan = document.getElementById("dropdownUsername");
  const roleSpan = document.getElementById("dropdownUserRole");

  if (usernameSpan) usernameSpan.textContent = currentUsername || "کاربر";
  if (roleSpan) {
    let roleText = "";
    if (currentUserRole === "admin") roleText = "مدیر کل";
    else if (currentUserRole === "finance") roleText = "مدیر مالی";
    else if (currentUserRole === "admin_staff") roleText = "مدیر اداری";
    else roleText = "کاربر";
    roleSpan.textContent = roleText;
  }
}

// منوی پروفایل
const profileImg = document.querySelector(".header_user_img");
const profileDropdown = document.getElementById("profileDropdown");

if (profileImg && profileDropdown) {
  profileImg.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
    updateProfileMenu(); // به‌روزرسانی محتوا قبل از نمایش
  });

  // بستن منو با کلیک خارج از آن
  document.addEventListener("click", (e) => {
    if (!profileImg.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.classList.remove("show");
    }
  });
}

// دکمه خروج داخل منو
const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");
if (dropdownLogoutBtn) {
  dropdownLogoutBtn.addEventListener("click", async () => {
    const res = await fetch("/api/logout", { method: "POST" });
    if (res.ok) window.location.href = "/login";
  });
}

// ================== مدیریت کاربران در تنظیمات (فقط ادمین) ==================
async function addUsersManagementToSettings(container) {
  // پیدا کردن بخش setting_card
  let settingCard = container.querySelector(".setting_card");
  if (!settingCard) {
    settingCard = document.createElement("div");
    settingCard.className = "setting_card";
    container.appendChild(settingCard);
  }

  // جلوگیری از اضافه شدن دوباره
  if (container.querySelector(".users-management-section")) return;

  const usersSection = document.createElement("div");
  usersSection.className = "setting_box users-management-section";
  usersSection.innerHTML = `
    <h3>👥 مدیریت کاربران</h3>
    <p>ایجاد، مشاهده و حذف کاربران سیستم  .</p>
    <button id="openUsersManagerBtn" class="setting_user_btn_show">مدیریت کاربران <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M15 3.75A5.25 5.25 0 0 0 9.75 9v10.19l4.72-4.72a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 0 1-1.06 0l-6-6a.75.75 0 1 1 1.06-1.06l4.72 4.72V9a6.75 6.75 0 0 1 13.5 0v3a.75.75 0 0 1-1.5 0V9c0-2.9-2.35-5.25-5.25-5.25Z" clip-rule="evenodd" />
</svg>
</button>
    <div id="usersManagerContainer" style="display:none; margin-top:12px;"></div>
  `;
  settingCard.appendChild(usersSection);

  const openBtn = usersSection.querySelector("#openUsersManagerBtn");
  const containerDiv = usersSection.querySelector("#usersManagerContainer");

  openBtn.addEventListener("click", async () => {
    if (containerDiv.style.display === "none") {
      containerDiv.style.display = "block";
      await loadUsersManager(containerDiv);

      openBtn.innerHTML = ` بستن مدیریت کاربران <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M21.53 9.53a.75.75 0 0 1-1.06 0l-4.72-4.72V15a6.75 6.75 0 0 1-13.5 0v-3a.75.75 0 0 1 1.5 0v3a5.25 5.25 0 1 0 10.5 0V4.81L9.53 9.53a.75.75 0 0 1-1.06-1.06l6-6a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd" />
</svg>
`;
    } else {
      containerDiv.style.display = "none";

      openBtn.innerHTML = `مدیریت کاربران  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M15 3.75A5.25 5.25 0 0 0 9.75 9v10.19l4.72-4.72a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 0 1-1.06 0l-6-6a.75.75 0 1 1 1.06-1.06l4.72 4.72V9a6.75 6.75 0 0 1 13.5 0v3a.75.75 0 0 1-1.5 0V9c0-2.9-2.35-5.25-5.25-5.25Z" clip-rule="evenodd" />
</svg>
`;
    }
  });
}

async function loadUsersManager(container) {
  container.innerHTML = '<div class="muted">در حال بارگذاری...</div>';
  try {
    const res = await fetch(API_BASE + "/users");
    if (!res.ok) {
      if (res.status === 403) throw new Error("شما دسترسی به این بخش ندارید");
      throw new Error("خطا در دریافت کاربران");
    }
    const users = await res.json();

    let html = `
      <div style="margin-bottom:12px;">
        <button id="showCreateUserFormBtn" class="openUsersManagerBtnn">+ کاربر جدید</button>
      </div>
      <div id="createUserFormPanel" autocomplete="off" style="display:none; margin-bottom:12px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <h4>ایجاد کاربر جدید</h4>
        <input type="text" id="newUsername" placeholder="نام کاربری" style="width:100%; margin-bottom:8px;" autocomplete="off">
        <input type="password" id="newPassword" placeholder="رمز عبور" style="width:100%; margin-bottom:8px;" autocomplete="off">
        <select id="newRole" style="width:100%; margin-bottom:8px;">
          <option value="admin_staff">مدیر اداری</option>
          <option value="finance">مدیر مالی</option>
          <option value="admin">ادمین</option>
        </select>
        <div style="display:flex; gap:8px;">
          <button id="createUserSubmitBtn" class="btn small">ایجاد</button>
          <button id="cancelCreateUserBtn" class="btn small ghost">انصراف</button>
        </div>
      </div>
      <div id="usersListContainer"></div>
    `;
    container.innerHTML = html;

    const createPanel = container.querySelector("#createUserFormPanel");
    const showBtn = container.querySelector("#showCreateUserFormBtn");
    if (showBtn)
      showBtn.addEventListener(
        "click",
        () => (createPanel.style.display = "block"),
      );

    const cancelBtn = container.querySelector("#cancelCreateUserBtn");
    if (cancelBtn)
      cancelBtn.addEventListener(
        "click",
        () => (createPanel.style.display = "none"),
      );

    const submitBtn = container.querySelector("#createUserSubmitBtn");
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        const username = container.querySelector("#newUsername").value.trim();
        const password = container.querySelector("#newPassword").value;
        const role = container.querySelector("#newRole").value;
        if (!username || !password) {
          alert("نام کاربری و رمز عبور الزامی است");
          return;
        }
        const response = await fetch(API_BASE + "/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, role }),
        });
        if (response.ok) {
          alert("کاربر با موفقیت ایجاد شد");
          createPanel.style.display = "none";
          await loadUsersManager(container); // refresh list
        } else {
          const err = await response.json();
          alert("خطا: " + (err.error || "نام کاربری تکراری است"));
        }
      });
    }

    const usersListDiv = container.querySelector("#usersListContainer");
    if (users.length === 0) {
      usersListDiv.innerHTML = '<div class="muted">هیچ کاربری یافت نشد</div>';
      return;
    }

    usersListDiv.innerHTML = users
      .map((u) => {
        const isSelf = u.id == currentUserId; // باید currentUserId را در scope داشته باشیم
        return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
        <div>
          <strong>${escapeHtml(u.username)}</strong>
          <div class="muted small">نقش: ${translateRole(u.role)} — تاریخ عضویت: ${new Date(u.created_at).toLocaleDateString("fa-IR")}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn small change-password-btn" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-is-self="${isSelf}">تغییر رمز</button>
          <button class="btn small danger delete-user-btn" data-id="${u.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
</svg>
</button>
        </div>
      </div>
    `;
      })
      .join("");

    usersListDiv.querySelectorAll(".delete-user-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("آیا از حذف این کاربر اطمینان دارید؟")) return;
        const userId = btn.dataset.id;
        const res = await fetch(API_BASE + "/users/" + userId, {
          method: "DELETE",
        });
        if (res.ok) {
          await loadUsersManager(container);
        } else {
          alert("خطا در حذف کاربر");
        }
      });
    });
    usersListDiv.querySelectorAll(".change-password-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.dataset.id;
        const username = btn.dataset.username;
        const isSelf = btn.dataset.isSelf === "true";

        // ایجاد مودال
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal-card";

        let html = `
      <h3>تغییر رمز عبور کاربر: ${escapeHtml(username)}</h3>
      <form id="changePasswordForm">
    `;
        if (isSelf) {
          html += `
        <label>رمز عبور قدیمی</label>
        <input type="password" id="oldPassword" placeholder="رمز عبور قدیمی" required>
      `;
        }
        html += `
        <label>رمز عبور جدید</label>
        <input type="password" id="newPassword" placeholder="رمز عبور جدید" required minlength="4">
        <label>تکرار رمز عبور جدید</label>
        <input type="password" id="confirmPassword" placeholder="تکرار رمز عبور جدید" required>
        <div class="form-actions">
          <button type="submit" class="btn">تغییر رمز</button>
          <button type="button" id="cancelPasswordForm" class="btn ghost">انصراف</button>
        </div>
      </form>
    `;
        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        modal.querySelector("#cancelPasswordForm").onclick = closeModal;
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) closeModal();
        });

        const form = modal.querySelector("#changePasswordForm");
        form.onsubmit = async (e) => {
          e.preventDefault();
          const newPassword = modal.querySelector("#newPassword").value;
          const confirmPassword = modal.querySelector("#confirmPassword").value;
          if (newPassword !== confirmPassword) {
            alert("رمز عبور جدید با تکرار آن مطابقت ندارد");
            return;
          }
          if (newPassword.length < 4) {
            alert("رمز عبور باید حداقل 4 کاراکتر باشد");
            return;
          }

          const body = { password: newPassword };
          if (isSelf) {
            const oldPassword = modal.querySelector("#oldPassword").value;
            if (!oldPassword) {
              alert("لطفاً رمز عبور قدیمی را وارد کنید");
              return;
            }
            body.oldPassword = oldPassword;
          }

          try {
            const res = await fetch(`${API_BASE}/users/${userId}/password`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
              alert("رمز عبور با موفقیت تغییر کرد");
              closeModal();
            } else {
              alert("خطا: " + (data.error || "تغییر رمز ناموفق بود"));
            }
          } catch (err) {
            console.error(err);
            alert("خطا در ارتباط با سرور");
          }
        };
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="muted">خطا: ${err.message}</div>`;
  }
}

// تابع ترجمه نقش (یک بار در کل فایل)
function translateRole(role) {
  if (role === "admin") return "ادمین";
  if (role === "finance") return "مدیر مالی";
  return "مدیر اداری";
}

let html5QrCode;
// نمایش مودال مدیریت سریال‌های یک محصول با امکان ویرایش قیمت هر سریال
// نمایش مودال مدیریت سریال‌های یک محصول با نمایش تک تک سریال‌ها و قابلیت گروهی
async function showSerialManagementModal(productId, productName) {
  try {
    const serials = await fetchSerials(productId);
    if (!serials.length) {
      alert("هیچ سریالی برای این کالا ثبت نشده است.");
      return;
    }

    // گروه‌بندی بر اساس مقدار سریال برای ایجاد بخش‌های گروهی
    const groups = new Map();
    for (const s of serials) {
      const val = s.serial;
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val).push(s);
    }

    // ایجاد مودال
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "10010";

    const modal = document.createElement("div");
    modal.className = "modal-card";
    modal.style.maxWidth = "1100px";
    modal.style.maxHeight = "80vh";
    modal.style.overflowY = "auto";

    let html = `
      <h3>مدیریت سریال‌های کالا: ${escapeHtml(productName)}</h3>
      <p style="font-size:13px; color:#6b7280;">می‌توانید هر سریال را جداگانه ویرایش کنید. برای اعمال یک قیمت به همه سریال‌های هم‌مقدار، از بخش گروه در بالای هر دسته استفاده کنید.</p>
    `;

    // برای هر گروه (هر مقدار سریال) یک بخش ایجاد کن
    for (const [serialValue, items] of groups.entries()) {
      const count = items.length;
      const groupId = `group_${serialValue.replace(/[^a-zA-Z0-9]/g, "_")}`;
      html += `
        <div style="background:#f9fafb; border-radius:8px; margin-top:16px; padding:12px; border:1px solid #e5e7eb;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            <div><strong style="font-size:16px;">🔹 سریال: ${escapeHtml(serialValue)} (${count} عدد)</strong></div>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="number" step="0.01" id="${groupId}_purchase" placeholder="قیمت خرید جدید" style="width:120px;">
              <input type="number" step="0.01" id="${groupId}_sale" placeholder="قیمت فروش جدید" style="width:120px;">
              <button class="btn small bulk-apply" data-group="${serialValue}" data-count="${count}" style="background:#0b5e8a; color:white;">📋 اعمال بر روی همه (${count} عدد)</button>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#fff; border-bottom:1px solid #ddd;">
                <th style="padding:6px; text-align:right;">سریال (ID)</th>
                <th style="padding:6px; text-align:center;">وضعیت</th>
                <th style="padding:6px; text-align:center;">قیمت خرید ($)</th>
                <th style="padding:6px; text-align:center;">قیمت فروش ($)</th>
                <th style="padding:6px; text-align:center;">عملیات</th>
              </tr>
            </thead>
            <tbody>
      `;
      for (const item of items) {
        const statusText = translateSerialStatus(item.status);
        html += `
          <tr data-serial-id="${item.id}" data-serial-value="${escapeHtml(item.serial)}" style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:6px;">${escapeHtml(item.serial)} <span class="muted small">(${item.id.substring(0, 8)}...)</span></td>
            <td style="padding:6px; text-align:center;">${statusText}</td>
            <td style="padding:6px; text-align:center;">
              <input type="number" step="0.01" class="purchase-price-input" value="${item.purchase_price !== null ? item.purchase_price : ""}" placeholder="—" style="width:100px;">
            </td>
            <td style="padding:6px; text-align:center;">
              <input type="number" step="0.01" class="sale-price-input" value="${item.sale_price !== null ? item.sale_price : ""}" placeholder="—" style="width:100px;">
            </td>
            <td style="padding:6px; text-align:center;">
              <button class="btn small save-single" data-id="${item.id}">💾 ذخیره</button>
            </td>
          </tr>
        `;
      }
      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `<div class="form-actions" style="margin-top:20px;"><button id="closeSerialManageModal" class="btn ghost">بستن</button></div>`;
    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // بستن مودال
    const closeBtn = modal.querySelector("#closeSerialManageModal");
    closeBtn.onclick = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // تابع به‌روزرسانی یک سریال (با id)
    async function updateSingleSerial(serialId, purchasePrice, salePrice) {
      try {
        const res = await fetch(`${API_BASE}/serials/${serialId}/price`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchase_price: purchasePrice,
            sale_price: salePrice,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در به‌روزرسانی");
        }
        // به‌روزرسانی داده محلی
        if (DB.data.serials) {
          const local = DB.data.serials.find((s) => s.id === serialId);
          if (local) {
            if (purchasePrice !== undefined)
              local.purchase_price = purchasePrice;
            if (salePrice !== undefined) local.sale_price = salePrice;
          }
        }
        return true;
      } catch (err) {
        alert(err.message);
        return false;
      }
    }

    // تابع به‌روزرسانی گروهی (همه سریال‌های با یک مقدار مشخص)
    async function bulkUpdate(serialValue, purchasePrice, salePrice) {
      const groupItems = groups.get(serialValue);
      if (!groupItems) return false;
      if (
        !confirm(
          `آیا از اعمال قیمت خرید ${purchasePrice !== null ? purchasePrice : "بدون تغییر"} و قیمت فروش ${salePrice !== null ? salePrice : "بدون تغییر"} به تمام ${groupItems.length} سریال با مقدار "${serialValue}" اطمینان دارید؟`,
        )
      ) {
        return false;
      }
      let success = true;
      for (const item of groupItems) {
        const ok = await updateSingleSerial(item.id, purchasePrice, salePrice);
        if (!ok) success = false;
      }
      return success;
    }

    // رویداد ذخیره تک سریال
    modal.querySelectorAll(".save-single").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const serialId = btn.getAttribute("data-id");
        const row = btn.closest("tr");
        const purchaseInput = row.querySelector(".purchase-price-input");
        const saleInput = row.querySelector(".sale-price-input");
        const purchasePrice = purchaseInput.value
          ? Number(purchaseInput.value)
          : null;
        const salePrice = saleInput.value ? Number(saleInput.value) : null;

        const success = await updateSingleSerial(
          serialId,
          purchasePrice,
          salePrice,
        );
        if (success) {
          alert("قیمت سریال با موفقیت به‌روز شد.");
          // رفرش مودال و صفحه اصلی
          renderMain("products");
          overlay.remove();
          await showSerialManagementModal(productId, productName);
        }
      });
    });

    // رویداد اعمال گروهی
    modal.querySelectorAll(".bulk-apply").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const serialValue = btn.getAttribute("data-group");
        const groupId = `group_${serialValue.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const purchaseInput = document.getElementById(`${groupId}_purchase`);
        const saleInput = document.getElementById(`${groupId}_sale`);
        const purchasePrice = purchaseInput.value
          ? Number(purchaseInput.value)
          : null;
        const salePrice = saleInput.value ? Number(saleInput.value) : null;

        const success = await bulkUpdate(serialValue, purchasePrice, salePrice);
        if (success) {
          alert(`قیمت‌ها برای تمام سریال‌های "${serialValue}" اعمال شد.`);
          renderMain("products");
          overlay.remove();
          await showSerialManagementModal(productId, productName);
        }
      });
    });
  } catch (err) {
    console.error(err);
    alert("خطا در دریافت اطلاعات سریال‌ها");
  }
}
async function openScanner() {
  const existingModal = document.getElementById("scannerModal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "scannerModal";
  modal.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: rgba(0,0,0,0.9); z-index: 10001;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  `;
  modal.innerHTML = `
    <div style="background: #fff; border-radius: 20px; width: 90%; max-width: 500px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <h3>اسکن سریال</h3>
        <button id="closeScannerBtn" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      <div id="qr-reader" style="width: 100%;"></div>
      <div id="scanResult" style="margin-top: 10px; text-align: center; font-size: 14px;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#closeScannerBtn");
  const resultDiv = modal.querySelector("#scanResult");

  closeBtn.onclick = () => {
    if (html5QrCode) html5QrCode.stop().catch((e) => console.warn(e));
    modal.remove();
  };

  // تلاش برای راه‌اندازی دوربین
  try {
    html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // تشخیص موبایل (برای استفاده از دوربین عقب)
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    const facingMode = isMobile ? "environment" : "user"; // در موبایل دوربین عقب، در کامپیوتر دوربین جلو (یا هر کدام که کار کند)

    await html5QrCode.start(
      { facingMode: facingMode },
      config,
      async (decodedText) => {
        await html5QrCode.stop();
        resultDiv.innerHTML = `✅ شناسایی شد: ${decodedText}<br>در حال دریافت اطلاعات...`;
        try {
          const res = await fetch(
            `${API_BASE}/serials/search?serial=${encodeURIComponent(decodedText)}`,
          );
          if (!res.ok) throw new Error("سریال یافت نشد");
          const data = await res.json();
          showSerialInfoModal(data);
          modal.remove();
        } catch (err) {
          resultDiv.innerHTML = `❌ ${err.message}<br>برای اسکن مجدد، مودال را ببندید و دوباره امتحان کنید.`;
        }
      },
      (errorMessage) => {
        console.warn("Scan error", errorMessage);
      },
    );
  } catch (err) {
    console.error("Camera error", err);
    let errorMsg = "خطا در دسترسی به دوربین. ";
    if (
      window.location.protocol !== "https:" &&
      !window.location.hostname.includes("localhost")
    ) {
      errorMsg +=
        "برای استفاده از دوربین در موبایل، لطفاً از اتصال HTTPS استفاده کنید (مثلاً با ngrok).";
    } else {
      errorMsg += "مطمئن شوید به دوربین دسترسی داده‌اید.";
    }
    resultDiv.innerHTML = `⚠️ ${errorMsg}`;
    // غیرفعال کردن دکمه بستن؟ نه، کاربر می‌تواند ببندد.
  }
}
function showSerialInfoModal(data) {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: rgba(0,0,0,0.8); z-index: 10002;
    display: flex; align-items: center; justify-content: center;
    overflow-y: auto;
  `;
  let transactionsHtml = "";
  if (data.transactions && data.transactions.length) {
    transactionsHtml = `<h4 style="margin-top:12px;">📋 تاریخچه فروش:</h4>
                        <table style="width:100%; border-collapse:collapse;">
                          <thead>
                            <tr style="background:#f0f0f0;">
                              <th style="padding:6px;">تاریخ</th>
                              <th style="padding:6px;">مشتری</th>
                              <th style="padding:6px;">قیمت واحد</th>
                              <th style="padding:6px;">تعداد</th>
                              <th style="padding:6px;">توضیحات</th>
                            </tr>
                          </thead>
                          <tbody>`;
    data.transactions.forEach((t) => {
      transactionsHtml += `<tr>
        <td style="padding:6px; border-bottom:1px solid #ddd;">${new Date(t.date).toLocaleDateString("fa-IR")}</td>
        <td style="padding:6px; border-bottom:1px solid #ddd;">${escapeHtml(t.customer_name)}</td>
        <td style="padding:6px; border-bottom:1px solid #ddd;">${t.unit_price !== "---" ? t.unit_price + " $" : "---"}</td>
        <td style="padding:6px; border-bottom:1px solid #ddd;">${t.qty || 1}</tr>
        <td style="padding:6px; border-bottom:1px solid #ddd;">${escapeHtml(t.note || "-")}</td>
      </tr>`;
    });
    transactionsHtml += `</tbody></table>`;
  } else {
    transactionsHtml =
      '<div class="muted small" style="margin-top:8px;">هیچ فروشی برای این سریال ثبت نشده است.</div>';
  }

  // قیمت فروش پیش‌فرض کالا (از دیتابیس محلی)
  let salePrice = "نامشخص";
  if (data.product_id && DB.data.products) {
    const product = DB.data.products.find((p) => p.id === data.product_id);
    if (product && product.defaultSalePrice)
      salePrice = product.defaultSalePrice;
  }

  modal.innerHTML = `
    <div style="background: #fff; border-radius: 24px; max-width: 650px; width: 95%; padding: 20px; max-height: 90%; overflow-y: auto;">
      <h3>📦 اطلاعات سریال</h3>
      <p><strong>🔢 سریال:</strong> ${escapeHtml(data.serial)}</p>
      <p><strong>🏷️ کالا:</strong> ${escapeHtml(data.product_name)}</p>
      <p><strong>📌 وضعیت فعلی:</strong> <span style="font-weight:bold;">${translateSerialStatus(data.status)}</span></p>
      <hr/>
      <p><strong>🧮 تعداد کل این سریال در سیستم:</strong> ${data.total_occurrences} عدد</p>
      <p><strong>✅ موجود در انبار (از این سریال):</strong> ${data.available_count} عدد
        ${data.available_count > 0 ? `<button id="quickSellBtn" class="btn small" style="margin-right: 8px; background: #0b5e8a;">فروش</button>` : ""}
      </p>
      <p><strong>❌ فروخته شده (از این سریال):</strong> ${data.sold_count} عدد</p>
      <p><strong>📦 موجودی کل کالا (همه سریال‌ها):</strong> ${data.product_stock} عدد</p>
      <p><strong>🕒 آخرین تغییر:</strong> ${new Date(data.date || data.created_at).toLocaleDateString("fa-IR")}</p>
      <hr/>
      ${transactionsHtml}
      <div style="display:flex; gap:8px; margin-top:20px; justify-content:flex-end;">
        <button id="printLabelFromScanBtn" class="btn" data-serial="${escapeHtml(data.serial)}" data-product="${escapeHtml(data.product_name)}">🖨️ چاپ لیبل QR</button>
        <button id="closeInfoModal" class="btn ghost">بستن</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#closeInfoModal").onclick = () => modal.remove();
  modal
    .querySelector("#printLabelFromScanBtn")
    .addEventListener("click", () => {
      const serial = modal
        .querySelector("#printLabelFromScanBtn")
        .getAttribute("data-serial");
      const product = modal
        .querySelector("#printLabelFromScanBtn")
        .getAttribute("data-product");
      printSerialLabel(serial, product);
    });

  const quickSellBtn = modal.querySelector("#quickSellBtn");
  if (quickSellBtn) {
    quickSellBtn.addEventListener("click", () => {
      modal.remove();
      showInvoiceFormWithPreset(data.product_id, data.serial, salePrice);
    });
  }
}
async function showProductSerialsModal(productId, productName) {
  try {
    const serials = await fetchSerials(productId);
    if (!serials.length) {
      alert("هیچ سریالی برای این کالا ثبت نشده است.");
      return;
    }

    // گروه‌بندی بر اساس مقدار سریال (برای نمایش در مودال)
    const groups = new Map();
    serials.forEach((s) => {
      const val = s.serial;
      if (!groups.has(val)) {
        groups.set(val, { serial: val, count: 0, statuses: [] });
      }
      const group = groups.get(val);
      group.count++;
      group.statuses.push(s.status);
    });

    const groupedList = Array.from(groups.values()).map((g) => {
      const allSame = g.statuses.every((s) => s === g.statuses[0]);
      let statusText = allSame ? translateSerialStatus(g.statuses[0]) : "مختلط";
      return { serial: g.serial, count: g.count, statusText };
    });

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.zIndex = "10003";
    const modalContent = document.createElement("div");
    modalContent.className = "modal-card";
    modalContent.style.maxWidth = "500px";
    modalContent.style.maxHeight = "80vh";
    modalContent.style.overflowY = "auto";

    let html = `<h3>لیبل سریال‌های کالا: ${escapeHtml(productName)}</h3>
                <div style="margin-bottom:12px; font-size:13px;">برای چاپ QR هر سریال روی دکمه مربوطه کلیک کنید.</div>
                <div style="display:flex; gap:8px; margin-bottom:12px;">
                  <button id="printAllSerialsBtn" class="btn small" style="background:#0b5e8a;">🖨️ چاپ همه سریال‌ها (${serials.length} عدد)</button>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">`;

    groupedList.forEach((group) => {
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #eee; border-radius:8px;">
          <div style="display:flex; flex-direction:column;">
            <strong>${escapeHtml(group.serial)}</strong>
            <span class="muted small">تعداد: ${group.count} عدد — وضعیت: ${group.statusText}</span>
          </div>
          <button class="btn small print-serial-label" data-serial="${escapeHtml(group.serial)}" data-product="${escapeHtml(productName)}">🖨️ چاپ لیبل (${group.count}×)</button>
        </div>
      `;
    });

    html += `</div><div class="form-actions" style="margin-top:16px;"><button id="closeSerialModal" class="btn ghost">بستن</button></div>`;
    modalContent.innerHTML = html;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // دکمه بستن
    modalContent.querySelector("#closeSerialModal").onclick = () =>
      modal.remove();
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    // دکمه چاپ تک سریال
    modalContent.querySelectorAll(".print-serial-label").forEach((btn) => {
      btn.addEventListener("click", () => {
        const serial = btn.getAttribute("data-serial");
        const product = btn.getAttribute("data-product");
        printSerialLabel(serial, product);
      });
    });

    // ========== دکمه چاپ همه سریال‌ها ==========
    const printAllBtn = modalContent.querySelector("#printAllSerialsBtn");
    if (printAllBtn) {
      printAllBtn.addEventListener("click", () => {
        printAllSerials(serials, productName);
      });
    }
  } catch (err) {
    console.error(err);
    alert("خطا در دریافت سریال‌ها");
  }
}
function translateSerialStatus(status) {
  if (status === "available" || status === "in" || status === null)
    return "موجود در انبار";
  if (status === "sold") return "فروخته شده";
  if (status === "out") return "خارج شده";
  return "نامشخص";
}

function printSerialLabel(serialText, productName) {
  const canvas = document.createElement("canvas");
  QRCode.toCanvas(canvas, serialText, { width: 200 }, (error) => {
    if (error) {
      console.error(error);
      alert("خطا در تولید QR کد");
      return;
    }
    const win = window.open();
    win.document.write(`
      <html dir="rtl">
      <head><title>چاپ لیبل سریال</title></head>
      <body style="text-align:center; font-family:sans-serif; padding-top:30px;">
        <div style="margin-top:20px;">
          <strong style="font-size:16px;">${escapeHtml(productName)}</strong><br/>
          <img src="${canvas.toDataURL()}" style="width:150px; height:150px; margin:10px;"/>
          <div style="font-size:12px; margin-top:8px;">${escapeHtml(serialText)}</div>
        </div>
        <script>window.print();<\/script>
      </body>
      </html>
    `);
    win.document.close();
  });
}
document.getElementById("scanBtn")?.addEventListener("click", openScanner);

// جستجوی دستی سریال با استفاده از فیلد quickSearch

// (اختیاری) اضافه کردن یک دکمه جستجو در کنار فیلد در صورت نبودن
// اگر قبلاً دکمه‌ای ندارید، می‌توانید یک دکمه با جاوااسکریپت بسازید
// ========== جستجوی دستی سریال با استفاده از quickSearch و quickSearchBtn موجود ==========
// ========== جستجوی دستی سریال با استفاده از quickSearch و quickSearchBtn ==========
(function () {
  const quickSearchInput = document.getElementById("quickSearch");
  const quickSearchBtn = document.getElementById("quickSearchBtn");

  if (!quickSearchInput || !quickSearchBtn) {
    console.warn("quickSearch or quickSearchBtn not found");
    return;
  }

  // حذف رفتارهای قبلی که ممکن است مزاحمت ایجاد کنند
  quickSearchInput.oninput = null;

  // تابع جستجوی سریال
  async function searchSerialFromQuickSearch() {
    const serial = quickSearchInput.value.trim();
    if (!serial) {
      alert("لطفاً یک سریال وارد کنید.");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/serials/search?serial=${encodeURIComponent(serial)}`,
      );
      if (!res.ok) throw new Error("سریال یافت نشد");
      const data = await res.json();
      showSerialInfoModal(data);
      // (اختیاری: پاک کردن فیلد بعد از جستجو)
      // quickSearchInput.value = "";
    } catch (err) {
      alert("خطا: " + err.message);
    }
  }

  // رویداد کلیک روی آیکون جستجو
  quickSearchBtn.addEventListener("click", (e) => {
    e.preventDefault();
    searchSerialFromQuickSearch();
  });

  // رویداد فشردن Enter در فیلد ورودی
  quickSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchSerialFromQuickSearch();
    }
  });
})();

async function printAllSerials(serials, productName) {
  if (!serials.length) {
    alert("هیچ سریالی برای چاپ وجود ندارد.");
    return;
  }

  const allSerialValues = serials.map((s) => s.serial);
  const qrDataUrls = [];

  // 1. تولید QR کدها در پنجره‌ی اصلی (با استفاده از Promise)
  for (let i = 0; i < allSerialValues.length; i++) {
    const serial = allSerialValues[i];
    try {
      const canvas = document.createElement("canvas");
      await new Promise((resolve, reject) => {
        QRCode.toCanvas(canvas, serial, { width: 150 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      qrDataUrls.push(canvas.toDataURL());
    } catch (err) {
      console.error(`خطا در تولید QR برای سریال ${serial}:`, err);
      qrDataUrls.push(""); // در صورت خطا، خالی بگذار
    }
  }

  // 2. باز کردن پنجره‌ی چاپ با محتوای آماده
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("پاپ‌آپ مسدود شده است. لطفاً اجازه باز شدن پنجره را بدهید.");
    return;
  }

  let itemsHtml = "";
  for (let i = 0; i < allSerialValues.length; i++) {
    const serial = allSerialValues[i];
    const imgSrc = qrDataUrls[i] || "";
    itemsHtml += `
      <div class="label-item">
        <strong>${escapeHtml(productName)}</strong>
        ${imgSrc ? `<img src="${imgSrc}" style="width:150px; height:150px; margin:5px auto;">` : '<div style="width:150px; height:150px; background:#f0f0f0; display:flex; align-items:center; justify-content:center;">خطا</div>'}
        <div class="serial-text">${escapeHtml(serial)}</div>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>لیبل سریال‌های ${escapeHtml(productName)}</title>
      <style>
        body {
          font-family: sans-serif;
          margin: 0;
          padding: 20px;
          direction: rtl;
        }
        .page {
          max-width: 1200px;
          margin: 0 auto;
        }
        h2 {
          text-align: center;
          margin-bottom: 20px;
        }
        .label-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }
        .label-item {
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          break-inside: avoid;
        }
        .label-item strong {
          display: block;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .label-item img {
          max-width: 150px;
          height: auto;
          margin: 5px auto;
        }
        .label-item .serial-text {
          font-size: 12px;
          margin-top: 8px;
          color: #333;
        }
        @media print {
          body {
            padding: 0;
          }
          .label-item {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <h2>لیبل سریال‌های کالا: ${escapeHtml(productName)}</h2>
        <div class="label-grid">
          ${itemsHtml}
        </div>
      </div>
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// نمایش هشدار اتمام اشتراک
async function checkLicenseAndWarn() {
  try {
    const res = await fetch("/api/license-status");
    const data = await res.json();
    if (data.expired) {
      alert(
        "⚠️ مدت اعتبار سیستم به پایان رسیده است. لطفاً با مدیر تماس بگیرید.",
      );
      // می‌توانید صفحه را قفل کنید (مثلاً المان‌ها را disable کنید)
    } else if (
      data.daysLeft !== undefined &&
      data.daysLeft <= 2 &&
      data.daysLeft >= 0
    ) {
      const msg = `⚠️ توجه: مدت اعتبار سیستم تا ${data.daysLeft} روز دیگر به پایان می‌رسد. لطفاً نسبت به تمدید اقدام کنید.`;
      showToast(msg, "warning");
    }
  } catch (err) {
    console.error("License check failed", err);
  }
}

function showToast(message, type) {
  let toast = document.getElementById("licenseToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "licenseToast";
    toast.style.cssText =
      "position:fixed; bottom:20px; left:20px; background:#f0ad4e; color:#fff; padding:12px 20px; border-radius:8px; z-index:10000; font-family:inherit; box-shadow:0 2px 5px rgba(0,0,0,0.2);";
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 8000);
}

// صدا زدن بعد از بارگذاری داده‌ها
DB.load()
  .then(() => {
    checkLicenseAndWarn();
    // ... بقیه کدهای اولیه مانند renderTabs و ...
  })
  .catch((err) => console.error(err));
