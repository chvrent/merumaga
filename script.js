document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', // 月表示
        locale: 'ja',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth'
        },
        buttonText: {
            today: '今日',
            month: '月',
            week: '週',
            list: 'リスト'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                // スプレッドシートから送られたデータを読み込む
                const response = await fetch('data.json');
                const data = await response.json();

                // カレンダー用のデータ形式に変換
                const events = data.map(item => {
                    // 日付形式の調整 (yyyy/mm/dd -> yyyy-mm-dd)
                    const dateStr = item.date.replace(/\//g, '-');
                    
                    return {
                        title: `[${item.media}] ${item.title}`,
                        start: dateStr,
                        description: `担当: ${item.pic}\nターゲット: ${item.target}`,
                        className: item.media.includes('女の転職') ? 'media-type-woman' : 'media-type-type',
                        allDay: true
                    };
                });

                successCallback(events);
            } catch (error) {
                console.error('データの読み込みに失敗しました:', error);
                failureCallback(error);
            }
        },
        eventClick: function(info) {
            // クリックした時に詳細をアラート表示（後でポップアップに改良可能）
            alert(
                '【' + info.event.title + '】\n' +
                info.event.extendedProps.description
            );
        }
    });

    calendar.render();
});
