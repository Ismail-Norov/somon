'use client';

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="page-title">Настройки</h1>
      <p className="page-sub">Базовая конфигурация Somon</p>
      <div className="card stack">
        <div className="row space-between">
          <span>Шкала оценок</span>
          <strong>5-балльная (расширяемая)</strong>
        </div>
        <div className="row space-between">
          <span>Формула прогресса</span>
          <strong>0.4 занятия + 0.4 задания + 0.2 посещаемость</strong>
        </div>
        <div className="row space-between">
          <span>Опоздание в посещаемости</span>
          <strong>считается присутствием</strong>
        </div>
        <div className="row space-between">
          <span>Часовой пояс отображения</span>
          <strong>локальное время браузера</strong>
        </div>
        <p style={{ marginBottom: 0 }}>
          Расширенные настройки (email/push, интеграции) запланированы на следующий этап.
        </p>
      </div>
    </div>
  );
}
