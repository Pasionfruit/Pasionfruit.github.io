import { useState } from "react";
import type { GoogleAuthState } from "../hooks/useGoogleAuth";
import { AdventureHomepage } from "../panels/adventure/Homepage";
import { CookingHomepage } from "../panels/cooking/Homepage";
import { FamilyHomepage } from "../panels/family/Homepage";
import { FinanceHomepage } from "../panels/finance/Homepage";
import { LearningHomepage } from "../panels/learning/Homepage";
import { MaintenanceHomepage } from "../panels/maintenance/Homepage";
import { TrainingHomepage } from "../panels/training/Homepage";

interface HomepageProps {
  authState: GoogleAuthState;
  onNavigateToApp: () => void;
}

export function Homepage({ authState, onNavigateToApp }: HomepageProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [eventFilter, setEventFilter] = useState<"week" | "month">("week");
  const [isTodoCollapsed, setIsTodoCollapsed] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [activePanel, setActivePanel] = useState<
    "family" | "finance" | "cooking" | "adventure" | "learning" | "training" | "maintenance" | null
  >(null);

  const [todos, setTodos] = useState<
    Array<{ id: string; text: string; completed: boolean; isEditing: boolean }>
  >([
    { id: "todo-1", text: "Review daily priorities", completed: false, isEditing: false },
    { id: "todo-2", text: "Complete one focused learning task", completed: false, isEditing: false },
    { id: "todo-3", text: "Prepare meals for tomorrow", completed: false, isEditing: false },
    { id: "todo-4", text: "Log expenses and update budget", completed: false, isEditing: false },
    { id: "todo-5", text: "Plan one work deliverable", completed: false, isEditing: false },
  ]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      await authState.signIn();
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : "Sign in failed");
      console.error("Sign in error:", error);
    } finally {
      setSigningIn(false);
    }
  };

  const panels = [
    {
      id: "family",
      name: "Family",
      icon: "🏡",
      description: "Family planning and household coordination",
      action: () => setActivePanel("family"),
      bgColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: "finance",
      name: "Finance",
      icon: "💰",
      description: "Budgeting, expenses, and financial tracking",
      action: () => setActivePanel("finance"),
      bgColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: "cooking",
      name: "Cooking",
      icon: "🍳",
      description: "Meal planning, recipes, and kitchen routines",
      action: () => setActivePanel("cooking"),
      bgColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
    {
      id: "adventure",
      name: "Adventure",
      icon: "🚀",
      description: "Adventure and exploration",
      action: () => setActivePanel("adventure"),
      bgColor: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    },
    {
      id: "learning",
      name: "Learning",
      icon: "📚",
      description: "Learning resources",
      action: () => setActivePanel("learning"),
      bgColor: "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)",
    },
    {
      id: "training",
      name: "Training",
      icon: "💪",
      description: "Training and development",
      action: () => setActivePanel("training"),
      bgColor: "linear-gradient(135deg, #ff7eb3 0%, #ff758c 100%)",
    },
    {
      id: "maintenance",
      name: "Maintenance",
      icon: "🛠️",
      description: "Maintenance tasks and upkeep tracking",
      action: () => setActivePanel("maintenance"),
      bgColor: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    },
    {
      id: "work",
      name: "Work",
      icon: "💼",
      description: "Work management and projects",
      action: onNavigateToApp,
      bgColor: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    },
  ];

  const canAccessPanels = authState.isAuthenticated || isGuestMode;
  const visiblePanels = isGuestMode
    ? panels.filter((panel) =>
      panel.id === "cooking" || panel.id === "learning" || panel.id === "training",
    )
    : panels;

  const upcomingEvents = [
    { id: "event-1", title: "Family Planning Session", date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
    { id: "event-2", title: "Training Block", date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    { id: "event-3", title: "Finance Review", date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000) },
    { id: "event-4", title: "Maintenance Check", date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000) },
  ];

  const now = new Date();
  const weekLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const filteredEvents = upcomingEvents.filter((event) => {
    if (eventFilter === "week") {
      return event.date <= weekLimit;
    }
    return event.date <= monthLimit;
  });

  const formatEventDate = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);

  const addTodo = () => {
    const text = newTodoText.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      { id: `todo-${Date.now()}`, text, completed: false, isEditing: false },
    ]);
    setNewTodoText("");
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const startEditingTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, isEditing: true } : { ...todo, isEditing: false },
      ),
    );
  };

  const updateTodoText = (id: string, text: string) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, text } : todo)),
    );
  };

  const finishEditingTodo = (id: string) => {
    setTodos((prev) =>
      prev
        .map((todo) => (todo.id === id ? { ...todo, text: todo.text.trim(), isEditing: false } : todo))
        .filter((todo) => todo.text.length > 0),
    );
  };

  const upcomingEventsWidget = (
    <article className="dashboard-widget dashboard-widget-events">
      <h3>Upcoming Events</h3>
      <div className="dashboard-filters" role="group" aria-label="Filter upcoming events">
        <button
          type="button"
          className={eventFilter === "week" ? "active" : ""}
          onClick={() => setEventFilter("week")}
        >
          Week
        </button>
        <button
          type="button"
          className={eventFilter === "month" ? "active" : ""}
          onClick={() => setEventFilter("month")}
        >
          Month
        </button>
      </div>
      <ul className="dashboard-list">
        {filteredEvents.map((event) => (
          <li key={event.id}>
            <span>{event.title}</span>
            <small>{formatEventDate(event.date)}</small>
          </li>
        ))}
      </ul>
    </article>
  );

  const dailyTodoWidget = (
    <article className="dashboard-widget dashboard-widget-todos">
      <div className="dashboard-widget-header">
        <h3>Daily To-Do List</h3>
        <button
          type="button"
          className="dashboard-collapse-toggle"
          onClick={() => setIsTodoCollapsed((prev) => !prev)}
          aria-expanded={!isTodoCollapsed}
          aria-controls="daily-todo-content"
        >
          {isTodoCollapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!isTodoCollapsed && (
        <div id="daily-todo-content" className="dashboard-widget-content">
          <div className="dashboard-todo-add">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a task"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
            />
            <button type="button" onClick={addTodo}>Add</button>
          </div>
          <ul className="dashboard-checklist">
            {todos.map((task) => (
              <li key={task.id}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTodo(task.id)}
                  aria-label={task.text}
                />
                {task.isEditing ? (
                  <input
                    className="dashboard-todo-edit"
                    type="text"
                    value={task.text}
                    onChange={(e) => updateTodoText(task.id, e.target.value)}
                    onBlur={() => finishEditingTodo(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishEditingTodo(task.id);
                    }}
                    autoFocus
                  />
                ) : (
                  <span className={task.completed ? "todo-completed" : ""}>{task.text}</span>
                )}
                <div className="dashboard-todo-actions">
                  <button type="button" onClick={() => startEditingTodo(task.id)}>Edit</button>
                  <button type="button" onClick={() => deleteTodo(task.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );

  const homepageDashboard = (
    <div className={`homepage-dashboard${isGuestMode ? " guest-mode" : ""}`}>
      <section className="homepage-dashboard-left" aria-label="Dashboard panels">
        <div className="panels-grid">
          {visiblePanels.map((panel) => (
            <div
              key={panel.id}
              className="panel-card"
              style={{ backgroundImage: panel.bgColor }}
              onClick={panel.action}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  panel.action();
                }
              }}
            >
              <div className="panel-icon">{panel.icon}</div>
              <h3>{panel.name}</h3>
            </div>
          ))}
        </div>
      </section>

      {!isGuestMode && (
        <aside className="homepage-dashboard-right" aria-label="Upcoming events and daily to-do">
          {upcomingEventsWidget}
          {dailyTodoWidget}
        </aside>
      )}
    </div>
  );

  if (canAccessPanels && activePanel === "family") {
    return <FamilyHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (canAccessPanels && activePanel === "finance") {
    return <FinanceHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (canAccessPanels && activePanel === "cooking") {
    return <CookingHomepage onBackToHub={() => setActivePanel(null)} onSignOut={() => setIsGuestMode(false)} />;
  }

  if (canAccessPanels && activePanel === "adventure") {
    return <AdventureHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (canAccessPanels && activePanel === "learning") {
    return <LearningHomepage onBackToHub={() => setActivePanel(null)} onSignOut={() => setIsGuestMode(false)} />;
  }

  if (canAccessPanels && activePanel === "training") {
    return <TrainingHomepage onBackToHub={() => setActivePanel(null)} onSignOut={() => setIsGuestMode(false)} />;
  }

  if (canAccessPanels && activePanel === "maintenance") {
    return <MaintenanceHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  return (
    <div className="homepage">
      <div className="homepage-header">
        <div className="homepage-content">
          <h1>Welcome to Pasionfruit Hub</h1>
          <p className="homepage-subtitle">
            {canAccessPanels
              ? "Access your life management tools"
              : "Sign in to manage your life"}
          </p>
        </div>
      </div>

      {!canAccessPanels ? (
        <>
          <div className="homepage-signin">
            <div className="signin-card">
              <h2>Get Started</h2>
              <p>Sign in with your Google account to access your personal management tools.</p>
              {signInError && (
                <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#fee", borderRadius: "8px", color: "#c33" }}>
                  {signInError}
                </div>
              )}
              <button
                onClick={handleSignIn}
                disabled={authState.isGisLoading || signingIn}
                className="signin-button"
              >
                {authState.isGisLoading || signingIn ? "Loading..." : "Sign In with Google"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignInError(null);
                  setIsGuestMode(true);
                }}
                className="signin-button secondary"
                style={{ marginTop: "10px" }}
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="homepage-authenticated">
          {homepageDashboard}

          <div className="user-card-footer">
            <button
              onClick={() => {
                setActivePanel(null);
                if (isGuestMode) {
                  setIsGuestMode(false);
                  return;
                }
                authState.signOut();
              }}
              className="signout-button"
            >
              {isGuestMode ? "Exit Guest Mode" : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
