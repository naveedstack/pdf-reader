"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import { 
  Bot, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Search, 
  CheckSquare, 
  Square, 
  ListFilter,
  Check,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import MessageItem from "@/components/chat/MessageItem";
import ChatInput from "@/components/chat/ChatInput";
import { db } from "@/lib/firebase/config"; 
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";

interface DocumentRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  createdAt: any;
  storageUrl?: string;
}

export default function WorkspaceChatPage() {
  return (
    <ProtectedRoute>
      <WorkspaceChatContent />
    </ProtectedRoute>
  );
}

function WorkspaceChatContent() {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar drawer state

  // --- 1. FETCH DOCUMENTS FROM FIRESTORE ---
  useEffect(() => {
    if (!user) return;

    const docsRef = collection(db, `workspaces/${user.uid}/documents`);
    const q = query(docsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDocs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => d.status === "READY") as DocumentRecord[];

      setDocuments(fetchedDocs);

      // Auto-select all documents on first load if nothing was selected yet
      setSelectedDocIds((prev) => {
        if (prev.size === 0 && fetchedDocs.length > 0) {
          return new Set(fetchedDocs.map((d) => d.id));
        }
        return prev;
      });
    });

    return () => unsubscribe();
  }, [user]);

  // --- 2. MULTI-DOCUMENT SELECT CONTROLS ---
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedDocIds(new Set(documents.map((d) => d.id)));
  };

  const handleClearAll = () => {
    setSelectedDocIds(new Set());
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) =>
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  // --- 3. CONFIGURE VERCEL AI SDK ---
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => {
        return {
          body: {
            messages,
            documentIds: Array.from(selectedDocIds),
            workspaceId: user?.uid,
          },
        };
      },
    });
  }, [selectedDocIds, user?.uid]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: `workspace-chat-${user?.uid}`,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // --- 4. FETCH HISTORY ON LOAD ---
  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "chats", `workspace-${user.uid}`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().messages) {
          setMessages(docSnap.data().messages);
        }
      } catch (err) {
        console.error("Failed to load workspace chat history:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    };

    loadHistory();
  }, [user, setMessages]);

  // --- 5. SAVE HISTORY TO FIRESTORE ---
  useEffect(() => {
    const saveHistory = async () => {
      if (!user || isFetchingHistory) return;

      if (messages.length > 0 && status !== "streaming" && status !== "submitted") {
        try {
          const docRef = doc(db, "chats", `workspace-${user.uid}`);
          const sanitizedMessages = JSON.parse(JSON.stringify(messages));

          await setDoc(docRef, {
            messages: sanitizedMessages,
            workspaceId: user.uid,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to save workspace chat history:", err);
        }
      }
    };

    saveHistory();
  }, [messages, status, isFetchingHistory, user]);

  // --- 6. AUTO-SCROLL ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, error]);

  const handleSendMessage = (text: string) => {
    if (selectedDocIds.size === 0) {
      alert("Please select at least one document from the sidebar to chat.");
      return;
    }
    sendMessage({ text });
  };

  const handleSaveEdit = async (messageId: string, newText: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1) {
      const truncatedMessages = messages.slice(0, messageIndex);
      setMessages(truncatedMessages);
    }
    sendMessage({ text: newText });
  };

  // Document checklist selection component
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-primary" /> Target Files
          </h2>
          <p className="text-[11px] text-slate-400 font-medium">Select context sources ({selectedDocIds.size}/{documents.length})</p>
        </div>
        {/* Toggle Controls */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button onClick={handleSelectAll} className="text-primary hover:underline">All</button>
          <span className="text-slate-300">|</span>
          <button onClick={handleClearAll} className="text-slate-400 hover:text-slate-600 hover:underline">None</button>
        </div>
      </div>

      {/* Document search */}
      <div className="p-3 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-lg focus:outline-none transition-all font-medium text-slate-700"
          />
        </div>
      </div>

      {/* Document Checklist Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {documents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 space-y-2">
            <AlertCircle className="h-6 w-6 mx-auto text-slate-300" />
            <p className="text-[11px] font-medium leading-normal max-w-[160px] mx-auto">No processed files available. Upload documents in your Dashboard first.</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No matching files found.</div>
        ) : (
          filteredDocs.map((docObj) => {
            const isChecked = selectedDocIds.has(docObj.id);
            return (
              <div 
                key={docObj.id}
                onClick={() => handleToggleDoc(docObj.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                  isChecked 
                    ? "bg-primary/5 border-primary/25 shadow-sm text-slate-800" 
                    : "bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-600"
                }`}
              >
                <div className="shrink-0 text-primary">
                  {isChecked ? (
                    <CheckSquare className="h-4.5 w-4.5" />
                  ) : (
                    <Square className="h-4.5 w-4.5 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate leading-snug">{docObj.fileName}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                    <FileText className="h-3 w-3 shrink-0" /> Ready for Q&A
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Desktop Sidebar (Left side, fixed width) */}
      <aside className="hidden md:block w-72 border-r bg-white shrink-0">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* Mobile Sidebar (Slide out panel) */}
      <aside className={`md:hidden absolute top-0 bottom-0 left-0 w-72 bg-white border-r z-50 transition-transform duration-300 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {renderSidebarContent()}
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-[calc(100dvh-64px)] overflow-hidden">
        {/* Toggle Button for mobile document selector */}
        <div className="md:hidden flex items-center justify-between p-3 border-b bg-white shrink-0 shadow-sm z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <Menu className="h-3.5 w-3.5" />
            <span>Target Files ({selectedDocIds.size})</span>
          </button>
          
          <div className="text-[11px] font-bold text-slate-400 bg-slate-50 border px-2.5 py-1 rounded-full uppercase tracking-wider">
            Workspace Chat
          </div>
        </div>

        {/* Scrollable messages container */}
        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar p-4 md:p-6 bg-slate-50/20 flex flex-col relative">
          {isFetchingHistory ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-semibold text-slate-500 text-sm">Loading workspace history...</p>
            </div>
          ) : messages.length === 0 && !error ? (
            // Welcome workspace briefing card
            <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full py-10 space-y-6 animate-in fade-in duration-500">
              <div className="text-center space-y-3">
                <div className="inline-flex bg-primary/10 p-5 rounded-full text-primary shadow-inner mb-2 animate-bounce">
                  <Bot className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Workspace Chat Ready</h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium">Ask questions across multiple documents at once. The AI will retrieve context from all selected sources.</p>
              </div>

              {selectedDocIds.size === 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm text-[13.5px]">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="font-medium">
                    <strong>No target files selected!</strong> Please check at least one document from the sidebar to start asking questions.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4.5 rounded-2xl flex items-start gap-3 shadow-sm text-[13.5px]">
                  <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5 border border-emerald-200 rounded-full bg-white p-0.5" />
                  <div className="font-medium space-y-1">
                    <p className="font-semibold text-emerald-900">Configured Sources ({selectedDocIds.size} ready)</p>
                    <p className="text-emerald-700 text-xs">AI will synthesize answers using records from the selected documents. Ask a question below to start.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-2">
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  isLoading={isLoading}
                  onSaveEdit={handleSaveEdit}
                />
              ))}

              {/* Error Handler */}
              {error && (
                <div className="flex justify-center my-6">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-center gap-3 text-sm max-w-[85%] shadow-sm">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                    <p className="font-medium">{error.message}</p>
                  </div>
                </div>
              )}

              {/* Loader */}
              {isLoading && messages[messages.length - 1]?.role === "user" && !error && (
                <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-end gap-2">
                    <div className="p-2 rounded-full bg-white border text-primary shadow-sm flex-shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium text-slate-500">Retrieving context & drafting response...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={scrollRef} className="h-px" />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="bg-white border-t p-4 md:p-6 shrink-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.01)]">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isFetchingHistory={isFetchingHistory}
          />
          {selectedDocIds.size === 0 && (
            <p className="text-[10px] text-amber-600 font-semibold text-center mt-2.5 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" /> Select at least one target document from the sidebar to chat.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
