'use client';

import { useEffect, useRef } from 'react';

type NotificationTodo = {
  id: number;
  title: string;
  due_date: string | null;
};

export function useNotifications(enabled: boolean) {
  const seen = useRef(new Set<number>());

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const poll = async () => {
      const response = await fetch('/api/notifications/check', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { todos: NotificationTodo[] };
      for (const todo of data.todos) {
        if (seen.current.has(todo.id)) continue;
        new Notification('Todo Reminder', {
          body: todo.due_date ? `${todo.title} is due at ${new Date(todo.due_date).toLocaleString()}` : todo.title,
        });
        seen.current.add(todo.id);
      }
    };

    poll();
    const interval = window.setInterval(poll, 30_000);
    return () => window.clearInterval(interval);
  }, [enabled]);
}
