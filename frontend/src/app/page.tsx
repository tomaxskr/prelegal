"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import jsPDF from "jspdf";

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

export default function HomePage() {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [collectedFields, setCollectedFields] = useState<Record<string, string>>({});
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [availableDocuments, setAvailableDocuments] = useState<string[]>([]);
  const [suggestedClosestDocument, setSuggestedClosestDocument] = useState<string | null>(null);
  const [isDocumentSupported, setIsDocumentSupported] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I can help draft legal documents from our supported template catalog. Tell me what document you want (for example: Mutual NDA, CSA, DPA, PSA, Pilot Agreement, SLA, BAA, Partnership Agreement, Software License Agreement, or Design Partner Agreement).",
    },
  ]);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isReadyForDraft, setIsReadyForDraft] = useState(false);
  const [activeModel, setActiveModel] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const normalizedDraftMarkdown = draftMarkdown
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/âs/g, "'s");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, isSending]);

  useEffect(() => {
    if (!isSending) {
      composerRef.current?.focus();
    }
  }, [isSending, chatMessages.length]);

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

  const handleComposerKeyDown = async (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
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

  interface PdfTableRow { label: string; value: string; }

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
        tableIndex++;
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

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4">
      <header className="bg-white border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[--dark-navy]">Prelegal</h1>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign in
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-1">
            Legal Document Creator
          </h2>
          <p className="text-gray-600 text-sm">
            Chat with AI to choose a supported template and build your document draft
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900">AI Chat</h3>
              <p className="text-sm text-gray-600 mt-1">
                If a document type is unsupported, AI will suggest the closest template we can generate.
              </p>
            </div>

            <div className="border border-gray-200 rounded-md p-3 h-[420px] overflow-y-auto bg-gray-50 space-y-3">
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
                    message.role === "assistant"
                      ? "bg-white border border-gray-200 text-gray-800"
                      : "ml-auto bg-[var(--blue-primary)] text-white"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {isSending && (
                <div className="max-w-[90%] rounded-md px-3 py-2 text-sm bg-white border border-gray-200 text-gray-500">
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
                placeholder="Describe your NDA details in your own words..."
                className="w-full p-3 border border-gray-300 rounded-md h-24 text-gray-900"
                disabled={isSending}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">Press Enter to send. Use Shift+Enter for a new line.</p>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[var(--purple-secondary)] text-white rounded hover:opacity-90 font-semibold text-sm disabled:opacity-60 shadow-sm"
                  disabled={isSending || !pendingMessage.trim()}
                  aria-label="Send message"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
                {activeModel && (
                  <p className="text-xs text-gray-500 text-right">Model: {activeModel}</p>
                )}
              </div>
            </form>

            <div className="mt-4 border-t border-gray-200 pt-3 text-sm text-gray-700 space-y-1">
              <p>
                Selected document: {selectedDocument || "Not selected yet"}
              </p>
              <p>Status: {isReadyForDraft ? "Ready for draft" : "Collecting details"}</p>
              <p>Missing fields: {missingFields.length}</p>
              {!isDocumentSupported && suggestedClosestDocument && (
                <p className="text-amber-700">
                  Unsupported request detected. Suggested closest option: {suggestedClosestDocument}
                </p>
              )}
              {availableDocuments.length > 0 && (
                <p className="text-xs text-gray-600">
                  Supported: {availableDocuments.join(", ")}
                </p>
              )}
              {chatError && <p className="text-red-600">Error: {chatError}</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Draft Preview</h2>
              <button
                onClick={handleDownloadDraft}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium text-sm"
                disabled={!draftMarkdown}
              >
                Download PDF
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded p-4 h-[640px] overflow-y-auto">
              {draftMarkdown ? (
                <article className="text-sm text-gray-800 space-y-2 leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 mt-4">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mt-3">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-gray-800">{children}</p>,
                      table: ({ children }) => (
                        <table className="w-full border-separate border-spacing-y-2">{children}</table>
                      ),
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => <tr>{children}</tr>,
                      td: ({ children }) => (
                        <td className="align-top first:pr-8 first:w-[36%] first:font-medium first:text-gray-600">{children}</td>
                      ),
                      li: ({ children }) => <li className="ml-5 list-disc text-sm text-gray-800">{children}</li>,
                      code: ({ children }) => (
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-xs text-gray-900">{children}</code>
                      ),
                    }}
                  >
                    {normalizedDraftMarkdown}
                  </ReactMarkdown>
                </article>
              ) : (
                <p className="text-sm text-gray-500">
                  Your generated draft will appear here after AI identifies the document type and collects enough details.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}