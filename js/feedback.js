const FEEDBACK_TABLE = "feedback_notes";
const MIN_LOADING_MS = 1000;

function getRuntimeEnv() {
  return import.meta.env || window.KASSADILLO_ENV || {};
}

function getSupabaseConfig() {
  const env = getRuntimeEnv();
  return {
    url: env.VITE_SUPABASE_URL || env.SUPABASE_URL || "",
    anonKey: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "",
  };
}

export function escapePlainText(value, maxLength) {
  const normalized = String(value ?? "").replace(/\u0000/g, "").trim();
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return normalized.replace(/[&<>"']/g, (character) => replacements[character]).slice(0, maxLength);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function insertFeedbackNote(note) {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase ortam değişkenleri eksik.");
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${FEEDBACK_TABLE}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(note),
  });

  if (!response.ok) {
    throw new Error(`Supabase isteği başarısız oldu: ${response.status}`);
  }
}

function openPanel(panel, firstInput) {
  panel.hidden = false;
  panel.classList.remove("is-closing");
  requestAnimationFrame(() => {
    panel.classList.add("is-open");
  });
  window.setTimeout(() => firstInput.focus(), 180);
}

function closePanel(panel, afterClose) {
  panel.classList.remove("is-open");
  panel.classList.add("is-closing");
  window.setTimeout(() => {
    panel.hidden = true;
    panel.classList.remove("is-closing");
    afterClose?.();
  }, 220);
}

function setStatus(status, message = "") {
  status.textContent = message;
  status.hidden = !message;
}

function setLoading(submitButton, loading) {
  submitButton.classList.toggle("is-loading", loading);
  submitButton.disabled = loading;
}

export function showToast(host, message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " is-error" : ""}`;
  toast.textContent = message;
  host.append(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 240);
  }, 2600);
}

export function initFeedback({
  openButton,
  panel,
  closeButton,
  form,
  nameInput,
  messageInput,
  status,
  submitButton,
  toastHost,
}) {
  openButton.addEventListener("click", () => openPanel(panel, nameInput));
  closeButton.addEventListener("click", () => closePanel(panel));
  panel.addEventListener("click", (event) => {
    if (event.target === panel && !submitButton.disabled) closePanel(panel);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status);

    const name = escapePlainText(nameInput.value, 80);
    const message = escapePlainText(messageInput.value, 1200);

    if (!name) {
      setStatus(status, "İsim alanını boş bırakma, not sahipsiz kalmasın.");
      nameInput.focus();
      return;
    }

    const minimumWait = delay(MIN_LOADING_MS);
    setLoading(submitButton, true);

    try {
      await Promise.all([
        minimumWait,
        insertFeedbackNote({
          name,
          message,
          page_path: `${window.location.pathname}${window.location.search}`,
          user_agent: window.navigator.userAgent,
        }),
      ]);

      closePanel(panel, () => form.reset());
      showToast(toastHost, "Başarıyla gönderildi.");
    } catch (error) {
      await minimumWait;
      console.error(error);
      setStatus(status, "Gönderilemedi. Supabase ayarlarını kontrol et.");
      showToast(toastHost, "Gönderilemedi.", "error");
    } finally {
      setLoading(submitButton, false);
    }
  });
}
