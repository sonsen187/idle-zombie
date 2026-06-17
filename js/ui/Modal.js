import { applySaveString } from '../systems.js';

export function showModal(title, text) {
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const modalEl = document.getElementById('info-modal');
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = text;
    if (modalEl) modalEl.classList.remove('hidden');
}

export function closeModal() {
    const modalEl = document.getElementById('info-modal');
    if (modalEl) modalEl.classList.add('hidden');
}

export function closeSaveModal() {
    const modal = document.getElementById('save-modal');
    if (modal) modal.classList.add('hidden');
}

export function copySaveToClipboard() {
    const box = document.getElementById('save-code-box');
    if (box) {
        box.select();
        document.execCommand('copy');
    }
}

export function importSaveData() {
    const box = document.getElementById('import-code-box');
    if (!box) return;
    const importStr = box.value.trim();
    if (!importStr) {
        showModal("Lỗi Nhập Liệu", "Vui lòng dán đoạn mã lưu trữ đã copy từ trước vào ô nhập!");
        return;
    }
    applySaveString(importStr, true);
    closeSaveModal();
}
