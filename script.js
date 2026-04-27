document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        firstDay: 2, // 0:日, 1:月, 2:火 => 火曜日始まりに設定
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                const response = await fetch('data.json');
                const data = await response.json();

                // 1. 時間順に並び替え (10:00, 12:00 など)
                data.sort((a, b) => {
                    const timeA = a.time || "99:99";
                    const timeB = b.time || "99:99";
                    return timeA.localeCompare(timeB);
                });

                // 2. カレンダー用のデータ形式に変換
                const events = data.map(item => {
                    const dateStr = item.date.replace(/\//g, '-');
                    
                    let eventColor = item.color;
                    if (eventColor === '#ffffff' || eventColor === 'white' || !eventColor) {
                        eventColor = item.media === '新規' ? '#28a745' : '#007bff';
                    }

                    return {
                        title: item.title,
                        start: dateStr,
                        backgroundColor: eventColor,
                        borderColor: eventColor,
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
        eventOrder: "start", // FullCalendar側の並び順指定
        eventClick: function(info) {
            const props = info.event.extendedProps;
            let detailText = `【${info.event.title}】\n\n`;
            detailText += `配信時間: ${props.time || '未設定'}\n`;
            detailText += `媒体: ${props.media}\n`;
            detailText += `ターゲット: ${props.target}\n`;
            detailText += `担当: ${props.pic}\n`;
            if (props.pr) detailText += `\n--- PR内容 ---\n${props.pr}`;
            alert(detailText);
        },
        eventContent: function(arg) {
            const timeStr = arg.event.extendedProps.time ? `${arg.event.extendedProps.time} ` : '';
            let el = document.createElement('div');
            el.className = 'fc-event-main-inner';
            el.innerHTML = `<b>${timeStr}</b>[${arg.event.extendedProps.media}] ${arg.event.title}`;
            return { domNodes: [el] };
        }
    });

    calendar.render();
});
