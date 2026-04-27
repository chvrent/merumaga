document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');

    // 火曜始まりの今週日付を計算
    function getTuesdayOfCurrentWeek() {
        let d = new Date();
        let day = d.getDay(); 
        let diff = (day >= 2) ? (day - 2) : (day + 5);
        d.setDate(d.getDate() - diff);
        return d.toISOString().split('T')[0];
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        initialDate: getTuesdayOfCurrentWeek(),
        locale: 'ja',
        firstDay: 2, // 2 = 火曜日
        slotMinTime: "08:00:00",
        slotMaxTime: "23:00:00",
        slotEventOverlap: false, // 重なりを許さず一行ずつ表示
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay,dayGridMonth'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                const response = await fetch('data.json');
                const data = await response.json();

                const events = data.map(item => {
                    const dateStr = item.date.replace(/\//g, '-');
                    const timeStr = item.time ? `T${String(item.time).padStart(2, '0')}:00:00` : 'T00:00:00';
                    
                    // 火曜起点での隔週計算 (週番号で偶奇判定)
                    const d = new Date(dateStr);
                    const weekNum = Math.floor((d.getTime() - (2 * 24 * 60 * 60 * 1000)) / (7 * 24 * 60 * 60 * 1000));
                    const isGroupA = (weekNum % 2 === 0);

                    return {
                        title: `[${item.media}] ${item.title}`,
                        start: dateStr + timeStr,
                        backgroundColor: isGroupA ? '#28a745' : '#e83e8c', // A:緑, B:ピンク
                        borderColor: isGroupA ? '#28a745' : '#e83e8c',
                        extendedProps: {
                            media: item.media,
                            time: item.time,
                            pic: item.pic,
                            target: item.target,
                            pr: item.pr
                        }
                    };
                });
                successCallback(events);
            } catch (error) {
                failureCallback(error);
            }
        },
        eventClick: function(info) {
            const props = info.event.extendedProps;
            let detail = `【${info.event.title}】\n配信: ${props.time || '未設定'}:00\n担当: ${props.pic}\n対象: ${props.target}`;
            if (props.pr) detail += `\n\n--- PR内容 ---\n${props.pr}`;
            alert(detail);
        }
    });

    calendar.render();
});
