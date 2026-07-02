// ==========================================
// 🌟 แก้บั๊ก Electron: อาการค้าง/พิมพ์ไม่ได้หลังปิดป๊อปอัพ (ครอบคลุม Alert, Confirm, Prompt)
// ==========================================
const originalAlert = window.alert;
window.alert = function(message) {
    originalAlert(message);
    // ดึงคีย์บอร์ดกลับมาทันทีเมื่อปิด Alert
    setTimeout(() => { window.focus(); }, 10);
};

const originalConfirm = window.confirm;
window.confirm = function(message) {
    const result = originalConfirm(message);
    // ดึงคีย์บอร์ดกลับมาทันทีเมื่อปิด Confirm
    setTimeout(() => { window.focus(); }, 10);
    return result;
};

const originalPrompt = window.prompt;
window.prompt = function(message, defaultText) {
    const result = originalPrompt(message, defaultText);
    // ดึงคีย์บอร์ดกลับมาทันทีเมื่อปิด Prompt
    setTimeout(() => { window.focus(); }, 10);
    return result;
};
// ==========================================

const fs = require('fs');
const path = require('path');
const os = require('os'); // 🌟 เพิ่มตัวช่วยหาที่อยู่เครื่องคอมพิวเตอร์

// ==========================================
// 1. ระบบจัดการไฟล์ในคอมพิวเตอร์ (File System)
// ==========================================

// 🌟 เปลี่ยนเป้าหมาย! สร้างโฟลเดอร์ไว้ที่ Documents/MangaTrackerData ของผู้ใช้
const dataDir = path.join(os.homedir(), 'Documents', 'MangaTrackerData');
const imgDir = path.join(dataDir, 'images');

// สร้างโฟลเดอร์อัตโนมัติถ้ายัังไม่มี
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const dataFile = path.join(dataDir, 'mangaData.json'); // ไฟล์ฐานข้อมูลของเรา

// ==========================================
// 2. ตัวแปรส่วนกลาง
// ==========================================
let mangaData = [];
let defaultTags = ["Action", "Comedy", "Drama", "Fantasy", "Romance", "สืบสวน"];
let defaultWarningTags = ["เนื้อหารุนแรง", "เลือดสาด", "สปอยล์"];
let masterTags = [];
let masterWarningTags = [];

let currentImage = "";
let currentTags = [];
let currentWarningTags = [];
let currentAltLinks = [];
let currentViewId = null;
let currentChapterIndex = -1; // ตัวแปรจำว่ากำลังแก้ไขรีวิวตอนที่เท่าไหร่

// ==========================================
// 3. ฟังก์ชันอ่าน/เขียนไฟล์ (แทน LocalStorage)
// ==========================================
function loadData() {
    if (fs.existsSync(dataFile)) {
        // ถ้ามีไฟล์เซฟอยู่แล้ว ให้โหลดจากไฟล์
        const raw = fs.readFileSync(dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        mangaData = parsed.mangaData || [];
        masterTags = parsed.masterTags || defaultTags;
        masterWarningTags = parsed.masterWarningTags || defaultWarningTags;
    } else {
        // เปิดครั้งแรก ลองดึงข้อมูลเก่าจาก LocalStorage (ถ้ามี) มาใส่ไฟล์
        mangaData = JSON.parse(localStorage.getItem('manga_data')) || [];
        masterTags = JSON.parse(localStorage.getItem('master_tags')) || defaultTags;
        masterWarningTags = JSON.parse(localStorage.getItem('master_warning_tags')) || defaultWarningTags;
        saveData(); 
    }
}

function saveData() {
    const dataToSave = { mangaData, masterTags, masterWarningTags };
    // เขียนข้อมูลทั้งหมดลงไฟล์ .json ในคอมพิวเตอร์
    fs.writeFileSync(dataFile, JSON.stringify(dataToSave, null, 2), 'utf8');
}

// ฟังก์ชันแปลงชื่อไฟล์ ให้กลายเป็นที่อยู่รูปภาพ
function getCoverPath(coverName) {
    if (!coverName) return '';
    if (coverName.startsWith('data:image')) return coverName; // รองรับรูปเก่าที่เคยเซฟแบบ Base64
    
    // 🌟 ดึงที่อยู่เต็มของไฟล์ในเครื่อง และแปลงให้โปรแกรมอ่านได้ชัวร์ๆ (เติม file:///)
    const fullPath = path.join(imgDir, coverName);
    return `file:///${fullPath.replace(/\\/g, '/')}`; 
}

window.onload = function() {
    loadData();
    renderTagSelects();
    renderDashboard();
};

// ==========================================
// 4. ฟังก์ชันจัดการรูปภาพ (ก๊อปปี้ไฟล์ต้นฉบับ) 🌟
// ==========================================
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        let sourcePath = file.path; 
        
        // 🌟 ทริคสำหรับ Electron เวอร์ชั่นใหม่ที่ซ่อน path เอาไว้
        try {
            const { webUtils } = require('electron');
            if (webUtils && webUtils.getPathForFile) {
                sourcePath = webUtils.getPathForFile(file);
            }
        } catch (err) {
            // ถ้าดึงไม่ได้ ให้ข้ามไปใช้ file.path แบบเดิม
        }

        if (!sourcePath) {
            alert("❌ ระบบถูกบล็อก ไม่สามารถอ่านที่อยู่ไฟล์ต้นฉบับได้ครับ");
            return;
        }

        const fileExt = path.extname(sourcePath);
        const fileName = 'cover_' + Date.now() + fileExt; // ตั้งชื่อไฟล์ใหม่กันซ้ำ
        const destPath = path.join(imgDir, fileName); // ที่อยู่โฟลเดอร์ปลายทาง

        // ก๊อปปี้ไฟล์ต้นฉบับไปเก็บที่ data/images/
        fs.copyFileSync(sourcePath, destPath);
        
        currentImage = fileName; // จำแค่ชื่อไฟล์
        alert("✅ โหลดรูปภาพต้นฉบับสำเร็จแล้ว!");

    } catch (error) {
        // เพิ่ม Alert บอกสาเหตุชัดๆ หากเกิดปัญหา
        alert("❌ เกิดข้อผิดพลาดในการเซฟรูปลงโฟลเดอร์: " + error.message);
    }
}

// ==========================================
// 5. ระบบหน้าต่าง Modal และการบันทึกฟอร์ม
// ==========================================
function closeModal() { document.getElementById('manga-modal').classList.remove('active'); }

function openModal(mode) {
    document.getElementById('manga-modal').classList.add('active');
    document.getElementById('manga-form').reset();
    currentImage = ""; currentTags = []; currentWarningTags = []; currentAltLinks = [];

    const statusText = document.getElementById('fetch-status');
    if (statusText) statusText.innerText = '';

    if (mode === 'edit') {
        document.getElementById('modal-title').innerText = "✏️ แก้ไขข้อมูล";
        const item = mangaData.find(m => m.id === currentViewId);
        if (item) {
            document.getElementById('form-id').value = item.id;
            document.getElementById('form-title').value = item.title;
            document.getElementById('form-type').value = item.type;
            document.getElementById('form-status').value = item.status;
            document.getElementById('form-date').value = item.date;
            document.getElementById('form-rating').value = item.rating;
            document.getElementById('form-link').value = item.link;
            document.getElementById('form-review').value = item.review;
            currentImage = item.cover || "";
            currentTags = [...(item.tags || [])];
            currentWarningTags = [...(item.warningTags || [])];
            currentAltLinks = [...(item.altLinks || [])];
        }
    } else {
        document.getElementById('modal-title').innerText = "➕ เพิ่มเรื่องใหม่";
        document.getElementById('form-id').value = "";
    }
    updateTagsUI();
    updateAltLinksUI();
}

function saveMangaForm(e) {
    e.preventDefault();
    const id = document.getElementById('form-id').value;
    const data = {
        id: id ? parseInt(id) : Date.now(),
        title: document.getElementById('form-title').value,
        type: document.getElementById('form-type').value,
        status: document.getElementById('form-status').value,
        date: document.getElementById('form-date').value,
        rating: document.getElementById('form-rating').value,
        link: document.getElementById('form-link').value,
        review: document.getElementById('form-review').value,
        cover: currentImage,
        tags: [...currentTags],
        warningTags: [...currentWarningTags],
        altLinks: [...currentAltLinks]
    };

    if (id) {
        const idx = mangaData.findIndex(m => m.id == parseInt(id));
        mangaData[idx] = data;
    } else {
        mangaData.push(data);
    }

    saveData(); // 🌟 เซฟลงไฟล์ในคอม
    document.getElementById('manga-form').reset();
    currentImage = ""; currentTags = []; currentWarningTags = []; currentAltLinks = [];
    closeModal();
    renderDashboard(); 
    if (id && currentViewId === parseInt(id)) renderDetail(currentViewId);
}

function deleteManga() {
    if (confirm('ลบเรื่องนี้ถาวร?')) {
        mangaData = mangaData.filter(m => m.id !== currentViewId);
        saveData(); // 🌟 เซฟลงไฟล์ในคอม
        backToDashboard();
        renderDashboard();
    }
}

// ==========================================
// 6. ระบบแสดงผล (UI Rendering)
// ==========================================
function renderDashboard() {
    const container = document.getElementById('manga-container');
    container.innerHTML = ''; 

    document.querySelector('.stat-card:nth-child(1) .stat-value').innerText = mangaData.length;
    document.querySelector('.stat-card:nth-child(2) .stat-value').innerText = mangaData.filter(m => m.status === 'ยังไม่จบ').length;
    document.querySelector('.stat-card:nth-child(3) .stat-value').innerText = mangaData.filter(m => m.status === 'จบแล้ว').length;

    const typeFilter = document.getElementById('filter-type') ? document.getElementById('filter-type').value : 'All';
    const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'All';
    const searchQuery = document.getElementById('search-bar') ? document.getElementById('search-bar').value.toLowerCase() : '';
    const sortBy = document.getElementById('sort-by') ? document.getElementById('sort-by').value : 'date-desc';

    let filteredList = mangaData.filter(item => {
        const matchType = (typeFilter === 'All' || item.type === typeFilter);
        const matchStatus = (statusFilter === 'All' || item.status === statusFilter);
        const matchSearch = item.title.toLowerCase().includes(searchQuery) || 
                            (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery))) ||
                            (item.warningTags && item.warningTags.some(t => t.toLowerCase().includes(searchQuery)));
        return matchType && matchStatus && matchSearch;
    });

    filteredList.sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.date || 0) - new Date(a.date || 0);
        if (sortBy === 'date-asc') return new Date(a.date || 0) - new Date(b.date || 0);
        if (sortBy === 'rating-desc') return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
        if (sortBy === 'rating-asc') return (parseFloat(a.rating) || 0) - (parseFloat(b.rating) || 0);
        return 0;
    });

    if (filteredList.length === 0) {
        container.innerHTML = `<div style="color: #6b7280; text-align: center; grid-column: 1 / -1; padding: 40px;">ไม่พบข้อมูล...</div>`;
        return;
    }

    filteredList.forEach(item => {
        const badgeClass = item.status === 'จบแล้ว' ? 'badge-completed' : 'badge-ongoing';
        const coverUrl = getCoverPath(item.cover); // 🌟 ดึงรูปจากฮาร์ดดิสก์
        const coverStyle = coverUrl ? `style="background-image: url('${coverUrl}')"` : '';

        container.innerHTML += `
            <div class="manga-card" onclick="renderDetail(${item.id})">
                <div class="card-cover" ${coverStyle}>
                    ${!item.cover ? 'No Cover' : ''}
                    <span class="card-badge ${badgeClass}">${item.status}</span>
                </div>
                <div class="card-content">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta">
                        <span style="background:#374151; padding:2px 6px; border-radius:4px;">${item.type}</span>
                        <span class="card-rating">⭐ ${item.rating || '0.0'}</span>
                    </div>
                </div>
            </div>`;
    });
}

function renderDetail(id) {
    currentViewId = id; 
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    window.scrollTo(0, 0); 

    const item = mangaData.find(m => m.id === id);
    if (!item) return;

    document.getElementById('detail-title').innerText = item.title;
    document.getElementById('detail-type').innerText = item.type;
    document.getElementById('detail-status').innerText = item.status;
    document.getElementById('detail-date').innerText = item.date || '-';
    document.getElementById('detail-rating').innerText = item.rating ? `⭐ ${item.rating}/5.0` : '-';
    document.getElementById('detail-review').innerText = item.review || 'ยังไม่มีบันทึกรีวิวสำหรับเรื่องนี้';
    
    const coverUrl = getCoverPath(item.cover); // 🌟 ดึงรูปจากฮาร์ดดิสก์
    const coverDiv = document.getElementById('detail-cover');
    coverDiv.style.backgroundImage = coverUrl ? `url('${coverUrl}')` : 'none';
    coverDiv.innerText = coverUrl ? '' : 'No Cover';

    const linkContainer = document.getElementById('detail-link-container');
    let linksHTML = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:5px;">';
    if (item.link) linksHTML += `<a href="${item.link}" target="_blank" class="btn" style="background-color:#10b981; display:inline-block; text-decoration:none; width:fit-content;">🌐 ลิงก์ไปอ่านต่อ (หลัก)</a>`;
    if (item.altLinks && item.altLinks.length > 0) {
        item.altLinks.forEach((altLink, idx) => {
            linksHTML += `<a href="${altLink}" target="_blank" class="btn btn-secondary" style="font-size: 13px; padding: 6px 12px; width: fit-content; display:inline-block; text-decoration:none;">🔗 ลิงก์สำรอง ${idx + 1}</a>`;
        });
    }
    linksHTML += '</div>';
    linkContainer.innerHTML = linksHTML;

    const tagsDiv = document.getElementById('detail-tags-list');
    tagsDiv.innerHTML = item.tags && item.tags.length > 0 ? item.tags.map(t => `<span class="tag-item">#${t}</span>`).join('') : '<span style="color:#6b7280;">ไม่มีแท็ก</span>';

    const warningSec = document.getElementById('detail-warning-section');
    const warningList = document.getElementById('detail-warning-tags-list');
    if (item.warningTags && item.warningTags.length > 0) {
        warningSec.classList.remove('hidden');
        warningList.innerHTML = item.warningTags.map(t => `<div class="warning-box">⚠️ ป้ายเตือน: ${t}</div>`).join('');
    } else {
        warningSec.classList.add('hidden');
    }

    // ===============================
    // จัดการรีวิวรายตอน (โชว์ข้อมูล)
    // ===============================
    const chapterList = document.getElementById('detail-chapter-list');
    if (!item.chapterReviews) item.chapterReviews = []; // ถ้าไม่เคยมีรีวิว ให้สร้างคลังเปล่าๆ ไว้

    if (item.chapterReviews.length > 0) {
        chapterList.innerHTML = item.chapterReviews.map((r, i) => `
            <div class="chapter-review-box">
                <div class="chapter-review-header">
                    <div class="chapter-title-text">
                        ตอนที่ ${r.chapterNo} ${r.title ? ' - ' + r.title : ''}
                    </div>
                    <div>
                        ${r.rating ? `<span class="chapter-rating-text">⭐ ${r.rating}</span>` : ''}
                        <button class="chapter-action-btn" onclick="openChapterModal('edit', ${i})">✏️ แก้ไข</button>
                        <button class="chapter-action-btn" style="color:#ef4444;" onclick="deleteChapterReview(${i})">🗑️ ลบ</button>
                    </div>
                </div>
                <div class="chapter-comment-text">${r.comment}</div>
            </div>
        `).join('');
    } else {
        chapterList.innerHTML = '<div style="color:#6b7280; font-size:14px; text-align:center; padding:10px;">ยังไม่มีรีวิวรายตอน คุณสามารถกดปุ่ม "เพิ่มรีวิวตอน" ด้านบนได้เลย!</div>';
    }
}

function backToDashboard() {
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
}

// ==========================================
// 7. ระบบจัดการแท็ก (เพิ่ม/ลบ/แก้ไข)
// ==========================================
function updateTagsUI() {
    const normalList = document.getElementById('form-tags-list');
    if (normalList) normalList.innerHTML = currentTags.map((t, i) => `<span class="tag-item">${t} <span style="cursor:pointer; color:#ef4444; font-weight:bold; margin-left:5px;" onclick="removeTag('normal', ${i})">✖</span></span>`).join('');
    
    const warningList = document.getElementById('form-warning-tags-list');
    if (warningList) warningList.innerHTML = currentWarningTags.map((t, i) => `<span class="tag-item" style="background:#7f1d1d; color:#fca5a5;">${t} <span style="cursor:pointer; color:#ef4444; font-weight:bold; margin-left:5px;" onclick="removeTag('warning', ${i})">✖</span></span>`).join('');
}

function addTag(type) {
    const selectBox = document.getElementById(type === 'normal' ? 'input-tag' : 'input-warning-tag');
    const val = selectBox.value;
    if (!val) return; 
    if (type === 'normal' && !currentTags.includes(val)) currentTags.push(val);
    else if (type === 'warning' && !currentWarningTags.includes(val)) currentWarningTags.push(val);
    selectBox.value = ""; updateTagsUI();
}

function removeTag(type, index) {
    if (type === 'normal') currentTags.splice(index, 1);
    else currentWarningTags.splice(index, 1);
    updateTagsUI();
}

function renderTagSelects() {
    const tagSelect = document.getElementById('input-tag');
    if (tagSelect) tagSelect.innerHTML = '<option value="">-- เลือกแท็ก --</option>' + masterTags.map(t => `<option value="${t}">${t}</option>`).join('');
    const warningSelect = document.getElementById('input-warning-tag');
    if (warningSelect) warningSelect.innerHTML = '<option value="">-- เลือกคำเตือน --</option>' + masterWarningTags.map(t => `<option value="${t}">${t}</option>`).join('');
}

// --- ฟังก์ชันเวลาพอกดปุ่ม "อัปเดต" ตัวเลือกแท็ก ---
function editMasterTags(type) {
    let list = type === 'normal' ? masterTags : masterWarningTags;
    let inputId = type === 'normal' ? 'manage-tag-normal' : 'manage-tag-warning';
    let inputElem = document.getElementById(inputId);
    let action = inputElem.value;

    if (!action || action.trim() === '') {
        alert('กรุณาพิมพ์ชื่อแท็กที่ต้องการจัดการครับ');
        return; 
    }
    
    action = action.trim();

    if (action.startsWith('-')) {
        // ถ้านำหน้าด้วย - แปลว่าต้องการลบ
        let tagToRemove = action.substring(1).trim();
        let index = list.indexOf(tagToRemove);
        if (index > -1) { 
            list.splice(index, 1); 
            alert(`🗑️ ลบแท็ก "${tagToRemove}" ออกจากตัวเลือกแล้ว`); 
        } else { 
            alert(`❌ ไม่พบแท็ก "${tagToRemove}" ให้ลบครับ`); 
        }
    } else {
        // ถ้าพิมพ์ปกติ แปลว่าต้องการเพิ่ม
        if (!list.includes(action)) { 
            list.push(action); 
            alert(`✅ เพิ่มแท็ก "${action}" เรียบร้อยแล้ว`); 
        } else { 
            alert(`⚠️ มีแท็ก "${action}" อยู่ในตัวเลือกแล้วครับ`); 
        }
    }
    
    inputElem.value = ""; // ล้างช่องพิมพ์เมื่อทำเสร็จ
    saveData(); // 🌟 เซฟลงไฟล์ JSON ในคอม
    renderTagSelects(); // อัปเดต Dropdown ทันที
}

// ==========================================
// 8. ระบบจัดการลิงก์สำรอง
// ==========================================
function addAltLink() {
    const input = document.getElementById('input-alt-link');
    const val = input.value.trim();
    if (val && !currentAltLinks.includes(val)) { currentAltLinks.push(val); input.value = ""; updateAltLinksUI(); }
}
function removeAltLink(index) { currentAltLinks.splice(index, 1); updateAltLinksUI(); }
function updateAltLinksUI() {
    const list = document.getElementById('form-alt-links-list');
    if (list) list.innerHTML = currentAltLinks.map((link, i) => `<div style="display:flex; justify-content:space-between; align-items:center; background:#374151; padding:6px 10px; border-radius:4px; margin-top:6px; font-size:12px;"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85%;">${link}</span><span style="cursor:pointer; color:#ef4444; font-weight:bold;" onclick="removeAltLink(${i})">✖ ลบ</span></div>`).join('');
}

// ==========================================
// 9. ระบบสำรองและนำเข้า (Backup / Restore)
// ==========================================
function exportBackup() {
    const backupData = { mangaData, masterTags, masterWarningTags };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `manga_tracker_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (parsedData.mangaData !== undefined) {
                if (confirm(`พบข้อมูล ${parsedData.mangaData.length} เรื่อง\nต้องการเขียนทับข้อมูลเดิมหรือไม่?`)) {
                    mangaData = parsedData.mangaData;
                    masterTags = parsedData.masterTags || defaultTags;
                    masterWarningTags = parsedData.masterWarningTags || defaultWarningTags;
                    saveData(); // 🌟 เซฟลงไฟล์ในคอมทันที
                    renderTagSelects(); renderDashboard(); alert('🎉 นำเข้าข้อมูลสำเร็จแล้ว!');
                }
            } else alert('❌ รูปแบบไฟล์ JSON ไม่ถูกต้อง');
        } catch (err) { alert('❌ เกิดข้อผิดพลาดในการอ่านไฟล์'); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ==========================================
// 10. ระบบจัดการรีวิวรายตอน (Chapter Reviews)
// ==========================================

function openChapterModal(mode, index = -1) {
    document.getElementById('chapter-modal').classList.add('active');
    document.getElementById('chapter-form').reset();
    currentChapterIndex = index;

    if (mode === 'edit' && index >= 0) {
        document.getElementById('chapter-modal-title').innerText = "✏️ แก้ไขรีวิวตอน";
        const item = mangaData.find(m => m.id === currentViewId);
        const review = item.chapterReviews[index];
        
        document.getElementById('form-chapter-no').value = review.chapterNo;
        document.getElementById('form-chapter-rating').value = review.rating || '';
        document.getElementById('form-chapter-title').value = review.title || '';
        document.getElementById('form-chapter-review').value = review.comment || '';
    } else {
        document.getElementById('chapter-modal-title').innerText = "➕ เพิ่มรีวิวตอน";
    }
}

function closeChapterModal() {
    document.getElementById('chapter-modal').classList.remove('active');
}

function saveChapterReview(e) {
    e.preventDefault();
    const item = mangaData.find(m => m.id === currentViewId);
    if (!item) return;
    if (!item.chapterReviews) item.chapterReviews = [];

    const newReview = {
        chapterNo: parseFloat(document.getElementById('form-chapter-no').value), // ให้ใส่จุดทศนิยมได้ เช่น ตอน 10.5
        rating: document.getElementById('form-chapter-rating').value,
        title: document.getElementById('form-chapter-title').value,
        comment: document.getElementById('form-chapter-review').value
    };

    if (currentChapterIndex >= 0) {
        // กรณีแก้ไข
        item.chapterReviews[currentChapterIndex] = newReview;
    } else {
        // กรณีเพิ่มใหม่
        item.chapterReviews.push(newReview);
    }

    // 🌟 พระเอกอยู่ตรงนี้: สั่งให้บังคับเรียงลำดับจากตอนมาก -> ไปน้อย ทันที!
    item.chapterReviews.sort((a, b) => b.chapterNo - a.chapterNo);

    saveData(); // เซฟลงไฟล์ในคอม
    closeChapterModal();
    renderDetail(currentViewId); // รีเฟรชหน้ารายละเอียดเพื่อโชว์ของใหม่
}

function deleteChapterReview(index) {
    if(confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรีวิวตอนนี้?")) {
        const item = mangaData.find(m => m.id === currentViewId);
        item.chapterReviews.splice(index, 1); // ลบออก 1 ตัว
        saveData();
        renderDetail(currentViewId);
    }
}

// ==========================================
// 11. ระบบดึงข้อมูลจากเว็บ (Scraping) - สายเจาะระบบ API (Nekopost & ทั่วไป)
// ==========================================
async function autoFetchData() {
    const urlInput = document.getElementById('auto-fetch-url').value.trim();
    const statusText = document.getElementById('fetch-status');
    
    if (!urlInput) {
        alert('กรุณาวางลิงก์เว็บมังงะก่อนครับ');
        return;
    }
    if (!urlInput.startsWith('http')) {
        alert('กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http:// หรือ https:// ครับ');
        return;
    }

    statusText.innerText = "⏳ กำลังเจาะระบบและดึงข้อมูล... กรุณารอสักครู่...";
    statusText.style.color = "#a78bfa";
    
    try {
        const fetchOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        let title = '';
        let imageUrl = '';

        // 🌟 1. สูตรลับเจาะเกราะ Nekopost (ดึงจาก API หลังบ้านโดยตรง)
        if (urlInput.includes('nekopost.net')) {
            // ดึง ID ออกมาจากลิงก์ เช่น /manga/15201 จะได้ 15201
            const idMatch = urlInput.match(/\/(manga|comic|novel)\/(\d+)/);
            if (idMatch && idMatch[2]) {
                const projectId = idMatch[2];
                try {
                    // แอบยิงไปที่ API หลังบ้านของเว็บเพื่อเอาชื่อเรื่อง
                    const apiRes = await fetch(`https://api.osemocphoto.com/frontAPI/getProjectInfo/${projectId}`);
                    if (apiRes.ok) {
                        const data = await apiRes.json();
                        if (data && data.projectInfo && data.projectInfo.projectName) {
                            title = data.projectInfo.projectName;
                        }
                    }
                } catch (e) { console.log('API Fetch Error'); }
                
                // รูปแบบลิงก์รูปภาพหน้าปกที่แน่นอนของ Nekopost
                imageUrl = `https://www.osemocphoto.com/collectManga/${projectId}/${projectId}_cover.jpg`;
            }
        }

        // 🌟 2. ถ้าไม่ใช่ Nekopost หรือหาชื่อไม่เจอ ให้ดึงแบบเว็บทั่วไป (ค้นหาแบบดิบๆ)
        if (!title || !imageUrl) {
            const response = await fetch(urlInput, fetchOptions);
            const htmlText = await response.text();
            
            // สกัดชื่อเรื่อง
            const titleMatch = htmlText.match(/<title>(.*?)<\/title>/i);
            const ogTitleMatch = htmlText.match(/property="og:title"\s+content="(.*?)"/i);
            if (ogTitleMatch && ogTitleMatch[1]) title = ogTitleMatch[1].trim();
            else if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();

            // สกัดรูปปก
            const ogImageMatch = htmlText.match(/property="og:image"\s+content="(.*?)"/i);
            if (ogImageMatch && ogImageMatch[1]) imageUrl = ogImageMatch[1];
        }

        // 🌟 3. เติมข้อมูลลงช่องในฟอร์ม
        if (title) {
            // ตัดคำต่อท้ายรุงรังออก
            title = title.split(' - ')[0].split(' | ')[0]; 
            document.getElementById('form-title').value = title;
        } else {
            // ถ้าไม่ได้ชื่อเรื่องมา ให้เคลียร์ช่องเป็นค่าว่างไว้
            document.getElementById('form-title').value = ""; 
        }
        document.getElementById('form-link').value = urlInput;

        // 🌟 4. ดาวน์โหลดรูปลงเครื่องของคุณ
        if (imageUrl) {
            if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

            let imgResponse = await fetch(imageUrl, fetchOptions);
            
            // ทริคพิเศษ: ถ้ารูป .jpg ไม่มี ให้ลองโหลดแบบ .png
            if (!imgResponse.ok && urlInput.includes('nekopost.net')) {
                imageUrl = imageUrl.replace('.jpg', '.png');
                imgResponse = await fetch(imageUrl, fetchOptions);
            }

            if (imgResponse.ok) {
                const arrayBuffer = await imgResponse.arrayBuffer();
                const buffer = require('buffer').Buffer.from(arrayBuffer); 
                
                let ext = '.jpg';
                if (imageUrl.toLowerCase().includes('.png')) ext = '.png';
                if (imageUrl.toLowerCase().includes('.webp')) ext = '.webp';
                const fileName = 'cover_scraped_' + Date.now() + ext;
                
                const destPath = path.join(imgDir, fileName);
                fs.writeFileSync(destPath, buffer); 
                currentImage = fileName; 
                
                // 👇 [อัปเกรดตรงนี้] เช็คว่าได้ชื่อเรื่องมาด้วยไหม
                if (title) {
                    statusText.innerText = "✅ ดึงชื่อเรื่องและดาวน์โหลดรูปปกสำเร็จ 100%!";
                    statusText.style.color = "#10b981"; // สีเขียว
                } else {
                    statusText.innerText = "✅ โหลดรูปปกสำเร็จ! (แต่ดึงชื่อเรื่องไม่ได้ รบกวนพิมพ์ชื่อเรื่องเองนะครับ)";
                    statusText.style.color = "#f59e0b"; // สีส้ม
                }

            } else {
                throw new Error("หาไฟล์รูปภาพบนเซิร์ฟเวอร์ไม่พบ");
            }
        } else {
            if (title) {
                statusText.innerText = "✅ ดึงชื่อเรื่องสำเร็จ (แต่หารูปปกไม่พบครับ)";
                statusText.style.color = "#f59e0b";
            } else {
                statusText.innerText = "❌ ไม่สามารถดึงข้อมูลได้เลย (เว็บอาจจะป้องกันไว้)";
                statusText.style.color = "#ef4444";
            }
        }

    } catch (error) {
        console.error("Scraping Error:", error);
        if (document.getElementById('form-title').value !== "") {
            statusText.innerText = "✅ ดึงชื่อเรื่องสำเร็จ (แต่รูปปกโดนบล็อกการดาวน์โหลดครับ)";
            statusText.style.color = "#f59e0b";
        } else {
            statusText.innerText = "❌ เกิดข้อผิดพลาดในการโหลดข้อมูล (ลิงก์อาจไม่ถูกต้อง)";
            statusText.style.color = "#ef4444";
        }
    }
}