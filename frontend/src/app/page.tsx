"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import jsPDF from "jspdf";
import { useAuth } from "@/context/AuthContext";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface DocumentChatSessionResponse {
  assistantMessage: string;
  selectedDocument: string | null;
  isDocumentSupported: boolean;
  suggestedClosestDocument: string | null;
  collectedFields: Record<string, string>;
  missingFields: string[];
  readyForDraft: boolean;
  draftMarkdown: string;
  availableDocuments: string[];
  model: string;
}

interface SavedDocumentSummary {
  id: number;
  selectedDocument: string;
  createdAt: string;
}

interface SavedDocumentDetail {
  id: number;
  selectedDocument: string;
  collectedFields: Record<string, string>;
  draftMarkdown: string;
  createdAt: string;
}

interface PdfTableRow {
  label: string;
  value: string;
}

const INITIAL_ASSISTANT_MESSAGE =
  "I can help draft legal documents from our supported template catalog. Tell me what document you want (for example: Mutual NDA, CSA, DPA, PSA, Pilot Agreement, SLA, BAA, Partnership Agreement, Software License Agreement, or Design Partner Agreement).";

export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, user, authToken, logout } = useAuth();

  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [collectedFields, setCollectedFields] = useState<Record<string, string>>({});
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [availableDocuments, setAvailableDocuments] = useState<string[]>([]);
  const [suggestedClosestDocument, setSuggestedClosestDocument] = useState<string | null>(null);
  const [isDocumentSupported, setIsDocumentSupported] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_ASSISTANT_MESSAGE },
  ]);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isReadyForDraft, setIsReadyForDraft] = useState(false);
  const [activeModel, setActiveModel] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocumentSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const normalizedDraftMarkdown = useMemo(
    () =>
      draftMarkdown
        .replace(/<span[^>]*>/gi, "")
        .replace(/<\/span>/gi, "")
        .replace(/âs/g, "'s"),
    [draftMarkdown]
  );

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, isSending]);

  useEffect(() => {
    if (!isSending) {
      composerRef.current?.focus();
    }
  }, [isSending, chatMessages.length]);

  const fetchSavedDocuments = useCallback(async () => {
    if (!authToken) {
      setSavedDocuments([]);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch("/api/documents", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`History request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as SavedDocumentSummary[];
      setSavedDocuments(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load document history";
      setHistoryError(message);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!(authToken && isLoggedIn)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchSavedDocuments();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authToken, isLoggedIn, fetchSavedDocuments]);

  const submitPendingMessage = async (updatedMessages: ChatMessage[]) => {
    setPendingMessage("");
    setChatMessages(updatedMessages);
    setIsSending(true);
    setChatError(null);

    try {
      const response = await fetch("/api/chat/document-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          state: {
            selectedDocument,
            collectedFields,
            missingFields,
            readyForDraft: isReadyForDraft,
            draftMarkdown,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as DocumentChatSessionResponse;
      setSelectedDocument(payload.selectedDocument);
      setCollectedFields(payload.collectedFields);
      setDraftMarkdown(payload.draftMarkdown);
      setAvailableDocuments(payload.availableDocuments);
      setSuggestedClosestDocument(payload.suggestedClosestDocument);
      setIsDocumentSupported(payload.isDocumentSupported);
      setMissingFields(payload.missingFields);
      setIsReadyForDraft(payload.readyForDraft);
      setActiveModel(payload.model);
      setChatMessages((previous) => [
        ...previous,
        { role: "assistant", content: payload.assistantMessage },
      ]);
    } catch (error) {
      const fallbackError =
        error instanceof Error ? error.message : "Unexpected error while contacting AI";
      setChatError(fallbackError);
      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I could not process that message right now. Please try again and I will continue guiding your document creation.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = pendingMessage.trim();
    if (!message || isSending) {
      return;
    }

    const updatedMessages = [...chatMessages, { role: "user" as const, content: message }];
    await submitPendingMessage(updatedMessages);
  };

  const handleComposerKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const message = pendingMessage.trim();
    if (!message || isSending) {
      return;
    }

    const updatedMessages = [...chatMessages, { role: "user" as const, content: message }];
    await submitPendingMessage(updatedMessages);
  };

  const extractHtmlTableRows = (text: string): { result: string; tables: PdfTableRow[][] } => {
    const tables: PdfTableRow[][] = [];
    const PLACEHOLDER = "__TABLE_PLACEHOLDER__";
    const result = text.replace(/<table[\s\S]*?<\/table>/gi, (tableBlock) => {
      const rows: PdfTableRow[] = [];
      const rowPattern = /<tr>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowPattern.exec(tableBlock)) !== null) {
        const cells: string[] = [];
        const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
          cells.push(
            cellMatch[1]
              .replace(/<br\s*\/?>/gi, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/<[^>]+>/g, "")
              .trim()
          );
        }
        if (cells.length >= 2) {
          rows.push({ label: cells[0], value: cells[1] });
        }
      }
      tables.push(rows);
      return PLACEHOLDER;
    });
    return { result, tables };
  };

  const handleDownloadDraft = () => {
    if (!normalizedDraftMarkdown) {
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 32;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const renderLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        y += 8;
        return;
      }

      let fontSize = 11;
      let fontStyle: "normal" | "bold" = "normal";
      let text = trimmed;

      if (trimmed.startsWith("### ")) {
        fontSize = 12;
        fontStyle = "bold";
        text = trimmed.slice(4);
      } else if (trimmed.startsWith("## ")) {
        fontSize = 14;
        fontStyle = "bold";
        text = trimmed.slice(3);
      } else if (trimmed.startsWith("# ")) {
        fontSize = 18;
        fontStyle = "bold";
        text = trimmed.slice(2);
      } else if (trimmed.startsWith("- ")) {
        text = `• ${trimmed.slice(2)}`;
      }

      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      const wrapped = doc.splitTextToSize(text, maxWidth);
      const lineHeight = fontSize + 4;
      ensureSpace(wrapped.length * lineHeight);

      for (const chunk of wrapped) {
        doc.text(chunk, margin, y);
        y += lineHeight;
      }

      y += fontStyle === "bold" ? 4 : 2;
    };

    const { result: textWithPlaceholders, tables } = extractHtmlTableRows(
      normalizedDraftMarkdown.replace(/\r\n/g, "\n")
    );

    let tableIndex = 0;
    const renderTableRows = (rows: PdfTableRow[]) => {
      const labelWidth = 160;
      const valueX = margin + labelWidth + 12;
      const valueMaxWidth = maxWidth - labelWidth - 12;
      const rowFontSize = 10;
      const rowLineHeight = rowFontSize + 4;
      for (const { label, value } of rows) {
        const valueLines = doc.splitTextToSize(value || "", valueMaxWidth);
        const rowHeight = Math.max(1, valueLines.length) * rowLineHeight + 4;
        ensureSpace(rowHeight);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(rowFontSize);
        doc.setTextColor(75, 85, 99);
        doc.text(label, margin, y);
        doc.setTextColor(30, 30, 30);
        valueLines.forEach((chunk: string, i: number) => {
          doc.text(chunk, valueX, y + i * rowLineHeight);
        });
        y += rowHeight;
      }
      doc.setTextColor(30, 30, 30);
      y += 6;
    };

    for (const segment of textWithPlaceholders.split("__TABLE_PLACEHOLDER__")) {
      segment.replace(/<[^>]+>/g, "").split("\n").forEach(renderLine);
      if (tableIndex < tables.length) {
        renderTableRows(tables[tableIndex]);
        tableIndex += 1;
      }
    }

    if (y > pageHeight - margin) {
      ensureSpace(0);
    }

    const fileName = (selectedDocument || "draft-document")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    doc.save(`${fileName || "document"}.pdf`);
  };

  const handleSaveDraft = async () => {
    if (!authToken || !selectedDocument || !draftMarkdown || isSavingDocument) {
      return;
    }

    setIsSavingDocument(true);
    setHistoryError(null);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          selectedDocument,
          collectedFields,
          draftMarkdown,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(payload?.detail || "Unable to save document");
      }

      await fetchSavedDocuments();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save document";
      setHistoryError(message);
    } finally {
      setIsSavingDocument(false);
    }
  };

  const loadSavedDocument = async (documentId: number) => {
    if (!authToken) {
      return;
    }

    setHistoryError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error("Unable to load selected document");
      }

      const payload = (await response.json()) as SavedDocumentDetail;
      setSelectedDocument(payload.selectedDocument);
      setCollectedFields(payload.collectedFields);
      setDraftMarkdown(payload.draftMarkdown);
      setMissingFields([]);
      setIsReadyForDraft(true);
      setChatMessages([
        { role: "assistant", content: INITIAL_ASSISTANT_MESSAGE },
        {
          role: "assistant",
          content: `Loaded saved draft #${payload.id} (${payload.selectedDocument}) from your history.`,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load selected document";
      setHistoryError(message);
    }
  };

  if (isAuthLoading || !isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-200 grid place-items-center px-4">
        <p className="text-sm">Loading workspace...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,_#dbeafe_0%,_#f8fafc_45%,_#e2e8f0_100%)] px-4 py-6">
      <header className="mx-auto mb-5 flex w-full max-w-7xl items-center justify-between rounded-2xl border border-slate-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[--dark-navy]">Prelegal</h1>
          <p className="text-xs text-slate-600">AI-assisted legal drafting workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
            {user?.name || user?.email}
          </div>
          <button
            onClick={() => {
              void logout();
              router.push("/login");
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto mb-5 w-full max-w-7xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Disclaimer: Documents generated here are draft materials only and are subject to legal review by qualified counsel.
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[320px_1fr_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">History</h2>
            <button
              onClick={() => void fetchSavedDocuments()}
              className="text-xs font-medium text-sky-700 hover:text-sky-900"
              type="button"
            >
              Refresh
            </button>
          </div>

          <p className="mb-3 text-xs text-slate-500">
            Saved drafts for your account. Database resets when server restarts.
          </p>

          {isHistoryLoading && <p className="text-xs text-slate-500">Loading history...</p>}
          {!isHistoryLoading && savedDocuments.length === 0 && (
            <p className="text-xs text-slate-500">No saved drafts yet.</p>
          )}

          <div className="space-y-2">
            {savedDocuments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void loadSavedDocument(item.id)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <p className="text-xs font-semibold text-slate-800">{item.selectedDocument}</p>
                <p className="mt-1 text-[11px] text-slate-500">{item.createdAt}</p>
              </button>
            ))}
          </div>

          {historyError && <p className="mt-3 text-xs text-rose-600">{historyError}</p>}
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-slate-900">AI Intake Chat</h3>
            <p className="text-sm text-slate-600">
              Provide business details and Prelegal will prepare a template-driven draft.
            </p>
          </div>

          <div className="h-[420px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "border border-slate-200 bg-white text-slate-800"
                    : "ml-auto bg-[var(--blue-primary)] text-white"
                }`}
              >
                {message.content}
              </div>
            ))}
            {isSending && (
              <div className="max-w-[90%] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="mt-4 space-y-3">
            <textarea
              ref={composerRef}
              autoFocus
              value={pendingMessage}
              onChange={(event) => setPendingMessage(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Describe your agreement needs or answer the latest question..."
              className="h-24 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              disabled={isSending}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Enter sends. Shift+Enter creates a new line.</p>
              <button
                type="submit"
                className="rounded-xl bg-[var(--purple-secondary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                disabled={isSending || !pendingMessage.trim()}
                aria-label="Send message"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>

          <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
            <p>Selected document: {selectedDocument || "Not selected yet"}</p>
            <p>Status: {isReadyForDraft ? "Ready for draft" : "Collecting details"}</p>
            <p>Missing fields: {missingFields.length}</p>
            {!isDocumentSupported && suggestedClosestDocument && (
              <p className="text-amber-700">
                Unsupported request detected. Suggested closest option: {suggestedClosestDocument}
              </p>
            )}
            {availableDocuments.length > 0 && (
              <p className="text-xs text-slate-600">Supported: {availableDocuments.join(", ")}</p>
            )}
            {chatError && <p className="text-rose-600">Error: {chatError}</p>}
            {activeModel && <p className="text-xs text-slate-500">Model: {activeModel}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Draft Preview</h2>
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveDraft()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                disabled={!draftMarkdown || !selectedDocument || isSavingDocument}
              >
                {isSavingDocument ? "Saving..." : "Save draft"}
              </button>
              <button
                onClick={handleDownloadDraft}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={!draftMarkdown}
              >
                Download PDF
              </button>
            </div>
          </div>

          <div className="h-[640px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
            {draftMarkdown ? (
              <article className="space-y-2 text-sm leading-relaxed text-slate-800">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mt-2 text-xl font-bold text-slate-900">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mt-4 text-lg font-semibold text-slate-900">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mt-3 text-base font-semibold text-slate-900">{children}</h3>
                    ),
                    p: ({ children }) => <p className="text-sm text-slate-800">{children}</p>,
                    table: ({ children }) => (
                      <table className="w-full border-separate border-spacing-y-2">{children}</table>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => <tr>{children}</tr>,
                    td: ({ children }) => (
                      <td className="align-top first:w-[36%] first:pr-8 first:font-medium first:text-slate-600">
                        {children}
                      </td>
                    ),
                    li: ({ children }) => <li className="ml-5 list-disc text-sm text-slate-800">{children}</li>,
                    code: ({ children }) => (
                      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-900">{children}</code>
                    ),
                  }}
                >
                  {normalizedDraftMarkdown}
                </ReactMarkdown>
              </article>
            ) : (
              <p className="text-sm text-slate-500">
                Your generated draft will appear here after AI identifies the document type and collects enough details.
              </p>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Legal disclaimer: This draft is informational and must be reviewed by a licensed attorney before use.
          </p>
        </section>
      </div>
    </main>
  );
}
