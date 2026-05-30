import { useStore, Task } from '@/store/useStore';
import { TimetableBlock } from '@/lib/aiService';

export interface AIAction {
  action: 'ADD_TASK' | 'UPDATE_TASK' | 'REMOVE_TASK' | 'COMPLETE_TASK' | 'RESCHEDULE_TASK' | 'CREATE_STUDY_BLOCK' | 'REBALANCE_SCHEDULE';
  data: any;
}

export const executeAIActions = (actions: AIAction[]) => {
  const store = useStore.getState();

  actions.forEach((act) => {
    try {
      switch (act.action) {
        case 'ADD_TASK':
          if (act.data.title) {
            const subjectId = act.data.subjectId || (store.subjects[0]?.id) || 'sub-general';
            const subjectName = store.subjects.find(s => s.id === subjectId)?.name || 'General Study';
            store.addTask({
              subjectId,
              subjectName,
              title: act.data.title,
              deadline: act.data.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
              estimatedMinutes: Number(act.data.estimatedMinutes) || 60,
            });
          }
          break;

        case 'UPDATE_TASK':
          if (act.data.taskId) {
            store.updateTask(act.data.taskId, {
              ...(act.data.title && { title: act.data.title }),
              ...(act.data.deadline && { deadline: act.data.deadline }),
              ...(act.data.estimatedMinutes && { estimatedMinutes: Number(act.data.estimatedMinutes) }),
            });
          }
          break;

        case 'REMOVE_TASK':
          if (act.data.taskId) {
            store.removeTask(act.data.taskId);
          }
          break;

        case 'COMPLETE_TASK':
          if (act.data.taskId) {
            const task = store.tasks.find((t: Task) => t.id === act.data.taskId);
            if (task && task.status !== 'completed') {
              store.toggleTaskStatus(act.data.taskId);
            }
          }
          break;

        case 'CREATE_STUDY_BLOCK':
          // Re-uses the setTimetable block logic but appends
          if (act.data.start && act.data.end && act.data.title) {
            const blockType = act.data.type || 'study';
            const colorsMap = {
              class: 'border-l-4 border-secondary bg-secondary-fixed text-on-surface',
              study: 'border-l-4 border-primary bg-primary-fixed text-on-surface',
              extracurricular: 'border-l-4 border-pink-500 bg-pink-950/20 text-pink-200',
              break: 'border-l-4 border-emerald-500 bg-emerald-950/20 text-emerald-200',
            };
            const newBlock: TimetableBlock = {
              id: `ai-block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              day: typeof act.data.day !== 'undefined' ? Number(act.data.day) : new Date().getDay(),
              start: act.data.start,
              end: act.data.end,
              title: act.data.title,
              type: blockType,
              color: act.data.color || colorsMap[blockType as keyof typeof colorsMap] || colorsMap.study,
              details: act.data.details || 'AI Scheduled'
            };
            store.setTimetable([...store.timetable, newBlock]);
          }
          break;

        case 'REBALANCE_SCHEDULE':
          // Invoke the local schedule generator
          store.generateSchedule();
          break;

        default:
          console.warn(`Unrecognized action: ${act.action}`);
      }
    } catch (err) {
      console.error(`Error executing AI action ${act.action}:`, err);
    }
  });

  // Automatically rebalance schedule if any task operations occurred and AI didn't explicitly request it
  const taskActions = ['ADD_TASK', 'UPDATE_TASK', 'REMOVE_TASK', 'COMPLETE_TASK'];
  if (actions.some(a => taskActions.includes(a.action)) && !actions.some(a => a.action === 'REBALANCE_SCHEDULE')) {
    store.generateSchedule();
  }
};
