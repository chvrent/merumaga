document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek', // 週の時間軸表示に変更
        locale: 'ja',
        firstDay: 2, // 火曜日始まり
        slotMinTime: "08:00:00", // 8時から表示
        slotMaxTime: "23:00:00", // 23時まで表示
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                const response = await fetch('data.json');
                const data = await response.json();

                const events = data.map(item => {
                    const dateStr = item.date.replace(/\//g, '-');
                    const timeStr = item.time ? `T${String(item.time).padStart(2, '0')}:00:00` : 'T00:00:00';
                    
                    let eventColor = item.color;
                    if (eventColor === '#ffffff' || eventColor === 'white' || !eventColor) {
                        eventColor = item.media === '新規' ? '#28a745' : '#007bff';
                    }

                    return {
                        title: `[${item.media}] ${item.title}`,
                        start: dateStr + timeStr,
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
        eventClick: function(info) {
            const props = info.event.extendedProps;
            let detailText = `【${info.event.title}】\n\n`;
            detailText += `配信時間: ${props.time || '未設定'}\n`;
            detailText += `媒体: ${props.media}\n`;
            detailText += `担当: ${props.pic}\n`;
            if (props.pr) detailText += `\n--- PR内容 ---\n${props.pr}`;
            alert(detailText);
        }
    });

    calendar.render();
});
