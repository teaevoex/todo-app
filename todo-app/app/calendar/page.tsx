'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/lib/hooks/useTheme';
import type { Holiday, Todo } from '@/lib/db';

function buildCalendar(month: Date) {
  const first = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    return current;
  });
}

export default function CalendarPage() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDay, setSelectedDay] = useState<{ date: string; items: Todo[] } | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const initialMonth = new URLSearchParams(window.location.search).get('month');
    if (initialMonth) {
      setMonth(new Date(`${initialMonth}-01T00:00:00Z`));
    }
  }, []);

  useEffect(() => {
    document.body.dataset.calendarLoaded = 'false';
    void Promise.all([
      fetch('/api/todos').then(async (response) => ((await response.json()) as { todos: Todo[] }).todos),
      fetch('/api/holidays').then(async (response) => ((await response.json()) as { holidays: Holiday[] }).holidays),
    ]).then(([todoList, holidayList]) => {
      setTodos(todoList);
      setHolidays(holidayList);
      document.body.dataset.calendarLoaded = 'true';
    });

    return () => {
      delete document.body.dataset.calendarLoaded;
    };
  }, []);

  useEffect(() => {
    const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
    router.replace(`/calendar?month=${key}`);
  }, [month, router]);

  const days = useMemo(() => buildCalendar(month), [month]);
  const today = new Date();

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: 'clamp(16px, 4vw, 24px)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <div>
          <p style={{ margin: 0, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>Calendar</p>
          <h1 style={{ margin: '8px 0 4px', fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}>
            {month.toLocaleString('en-SG', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={toggleTheme} style={buttonStyle}>
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
          <button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} style={buttonStyle}>
            Prev
          </button>
          <button type="button" onClick={() => setMonth(new Date())} style={buttonStyle}>
            Today
          </button>
          <button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} style={buttonStyle}>
            Next
          </button>
          <Link href="/" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center' }}>
            Back
          </Link>
        </div>
      </header>

      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ minWidth: 700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 10 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <strong key={label} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                {label}
              </strong>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
            {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const items = todos.filter((todo) => todo.due_date?.slice(0, 10) === key);
          const holiday = holidays.find((entry) => entry.date === key);
          const isCurrentMonth = day.getUTCMonth() === month.getUTCMonth();
          const isToday =
            day.getUTCFullYear() === today.getUTCFullYear() &&
            day.getUTCMonth() === today.getUTCMonth() &&
            day.getUTCDate() === today.getUTCDate();

          return (
            <button
              type="button"
              key={key}
              aria-label={`Open ${key}`}
              onClick={() => {
                if (items.length > 0) {
                  setSelectedDay({ date: key, items });
                }
              }}
              style={{
                minHeight: 120,
                textAlign: 'left',
                borderRadius: 18,
                border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                background: isCurrentMonth ? 'var(--surface)' : 'rgba(255,255,255,0.04)',
                padding: 12,
                color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{day.getUTCDate()}</strong>
                {items.length > 0 ? <span style={{ color: 'var(--accent)' }}>{items.length}</span> : null}
              </div>
              {holiday ? <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 6 }}>{holiday.name}</div> : null}
              <div style={{ display: 'grid', gap: 6 }}>
                {items.slice(0, 3).map((item) => (
                  <span key={item.id} style={{ fontSize: 13, borderRadius: 10, background: 'var(--surface-alt)', padding: '0.3rem 0.5rem' }}>
                    {item.title}
                  </span>
                ))}
              </div>
            </button>
            );
          })}
          </div>
        </div>
      </div>

      {selectedDay ? (
        <div style={modalBackdropStyle}>
          <section style={modalCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>Day Details</p>
                <h2 style={{ margin: '8px 0 0' }}>{selectedDay.date}</h2>
              </div>
              <button type="button" onClick={() => setSelectedDay(null)} style={buttonStyle}>
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {selectedDay.items.map((item) => (
                <article key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, background: 'var(--surface-alt)' }}>
                  <strong>{item.title}</strong>
                  {item.due_date ? <p style={{ marginBottom: 0, color: 'var(--muted)' }}>{new Date(item.due_date).toLocaleString('en-SG')}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

const buttonStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0.75rem 0.9rem',
};

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  zIndex: 50,
};

const modalCardStyle: CSSProperties = {
  width: 'min(100%, 560px)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 20,
};
