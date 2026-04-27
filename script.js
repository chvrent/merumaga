async function loadSchedule() {
    const listContainer = document.getElementById('schedule-list');
    
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('データの読み込みに失敗しました');
        
        const data = await response.json();
        renderSchedule(data);
        setupFilters(data);
    } catch (error) {
        listContainer.innerHTML = `<div class="error">エラー: ${error.message}</div>`;
    }
}

function renderSchedule(items) {
    const listContainer = document.getElementById('schedule-list');
    listContainer.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'schedule-item';
        
        const statusClass = item.status === '完了' ? 'done' : (item.status === '進行中' ? 'working' : '');
        
        div.innerHTML = `
            <div class="date-time">
                ${item.date}<br>
                <small>${item.time || ''}</small>
            </div>
            <div class="content">
                <span class="title">${item.title}</span>
                <span class="meta">${item.media} | 担当: ${item.pic} | ターゲット: ${item.target}</span>
            </div>
            <div class="status ${statusClass}">${item.status || '未着手'}</div>
        `;
        listContainer.appendChild(div);
    });
}

function setupFilters(data) {
    const mediaFilter = document.getElementById('filter-media');
    const picFilter = document.getElementById('filter-pic');
    
    const medias = [...new Set(data.map(item => item.media))].filter(Boolean);
    const pics = [...new Set(data.map(item => item.pic))].filter(Boolean);
    
    medias.forEach(m => mediaFilter.add(new Option(m, m)));
    pics.forEach(p => picFilter.add(new Option(p, p)));
    
    const filterAction = () => {
        const filtered = data.filter(item => {
            return (!mediaFilter.value || item.media === mediaFilter.value) &&
                   (!picFilter.value || item.pic === picFilter.value);
        });
        renderSchedule(filtered);
    };
    
    mediaFilter.addEventListener('change', filterAction);
    picFilter.addEventListener('change', filterAction);
}

document.addEventListener('DOMContentLoaded', loadSchedule);
