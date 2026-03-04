import TodoApp from "@/components/shelter/todo-app";

export default function ShelterTasks() {
  return (
    
      <div className="p-4 md:p-6" data-testid="page-shelter-tasks">
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage your shelter's tasks and to-dos</p>
        </div>
        <TodoApp />
      </div>
    
  );
}
