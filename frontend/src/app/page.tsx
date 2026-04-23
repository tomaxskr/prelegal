"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { NDAFormData, getEmptyFormData } from "@/components/NDAForm";
import NDAPreview from "@/components/NDAPreview";
import jsPDF from "jspdf";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface NDAChatSessionResponse {
  assistantMessage: string;
  formData: NDAFormData;
  missingFields: string[];
  readyForReview: boolean;
  model: string;
}

export default function HomePage() {
  const [formData, setFormData] = useState<NDAFormData>(getEmptyFormData());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I can help draft a Mutual NDA. Tell me what this NDA is for, and I will ask follow-up questions to fill all required fields.",
    },
  ]);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isReadyForReview, setIsReadyForReview] = useState(false);
  const [activeModel, setActiveModel] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, isSending]);

  const submitPendingMessage = async (message: string, updatedMessages: ChatMessage[]) => {
    setPendingMessage("");
    setChatMessages(updatedMessages);
    setIsSending(true);
    setChatError(null);

    try {
      const response = await fetch("/api/chat/nda-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          currentForm: formData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as NDAChatSessionResponse;
      setFormData(payload.formData);
      setMissingFields(payload.missingFields);
      setIsReadyForReview(payload.readyForReview);
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
            "I could not process that message right now. Please try again and I will continue collecting your Mutual NDA details.",
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
    await submitPendingMessage(message, updatedMessages);
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
    await submitPendingMessage(message, updatedMessages);
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let y = 20;

    const addText = (text: string, fontSize = 10, isBold = false, spacing = 5) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.text(line, margin, y);
        y += spacing + fontSize / 4;
      });
    };

    const addHeading = (text: string) => {
      addText(text, 14, true, 5);
      y += 3;
    };

    const addSubheading = (text: string) => {
      addText(text, 11, true, 4);
    };

    addHeading("Mutual Non-Disclosure Agreement");

    addText(
      "This Mutual Non-Disclosure Agreement (the 'MNDA') consists of: (1) this Cover Page ('Cover Page') and (2) the Common Paper Mutual NDA Standard Terms Version 1.0.",
      9
    );
    y += 5;

    addSubheading("Purpose");
    addText(formData.purpose || "[Purpose]");
    y += 5;

    addSubheading("Effective Date");
    addText(formatDate(formData.effectiveDate));
    y += 5;

    addSubheading("MNDA Term");
    addText(
      formData.ndaTerm === "1year"
        ? "Expires 1 year(s) from Effective Date"
        : "Continues until terminated"
    );
    y += 5;

    addSubheading("Term of Confidentiality");
    addText(
      formData.termOfConfidentiality === "1year"
        ? "1 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret"
        : "In perpetuity"
    );
    y += 5;

    addSubheading("Governing Law & Jurisdiction");
    addText(`Governing Law: ${formData.governingLaw || "[State]"}`);
    addText(`Jurisdiction: ${formData.jurisdiction || "[Location]"}`);
    y += 5;

    if (formData.modifications) {
      addSubheading("MNDA Modifications");
      addText(formData.modifications);
      y += 5;
    }

    addText("By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.", 9);
    y += 10;

    const colWidth = (maxWidth - 10) / 2;
    const leftCol = margin;
    const rightCol = margin + colWidth + 10;
    let yLeft = y;
    let yRight = y;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PARTY 1", leftCol, yLeft);
    doc.text("PARTY 2", rightCol, yRight);
    yLeft += 6;
    yRight += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Signature:", leftCol, yLeft);
    doc.text("Signature:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.signature || "________________", leftCol, yLeft);
    doc.text(formData.party2.signature || "________________", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Print Name:", leftCol, yLeft);
    doc.text("Print Name:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.printName || "[Name]", leftCol, yLeft);
    doc.text(formData.party2.printName || "[Name]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Title:", leftCol, yLeft);
    doc.text("Title:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.title || "[Title]", leftCol, yLeft);
    doc.text(formData.party2.title || "[Title]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Company:", leftCol, yLeft);
    doc.text("Company:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.company || "[Company]", leftCol, yLeft);
    doc.text(formData.party2.company || "[Company]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Notice Address:", leftCol, yLeft);
    doc.text("Notice Address:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.noticeAddress || "[Address]", leftCol, yLeft);
    doc.text(formData.party2.noticeAddress || "[Address]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Date:", leftCol, yLeft);
    doc.text("Date:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(formData.party1.date), leftCol, yLeft);
    doc.text(formatDate(formData.party2.date), rightCol, yRight);

    y = Math.max(yLeft, yRight) + 10;

    doc.addPage();
    y = 20;

    addHeading("Standard Terms");

    const terms = [
      {
        title: "1. Introduction",
        text: "This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page) ('MNDA') allows each party ('Disclosing Party') to disclose or make available information in connection with the Purpose which (1) the Disclosing Party identifies as 'confidential', 'proprietary', or the like or (2) should be reasonably understood as confidential or proprietary due to its nature ('Confidential Information').",
      },
      {
        title: "2. Use and Protection of Confidential Information",
        text: "The Receiving Party shall: (a) use Confidential Information solely for the Purpose; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval; (c) protect Confidential Information using at least a reasonable standard of care.",
      },
      {
        title: "3. Exceptions",
        text: "The Receiving Party's obligations do not apply to information that: (a) is publicly available; (b) it rightfully knew prior to receipt; (c) it rightfully obtained from a third party; (d) it independently developed.",
      },
      {
        title: "4. Disclosures Required by Law",
        text: "The Receiving Party may disclose Confidential Information to the extent required by law, provided it provides reasonable advance notice.",
      },
      {
        title: "5. Term and Termination",
        text: "This MNDA expires at the end of the MNDA Term. Either party may terminate upon written notice. Obligations survive for the Term of Confidentiality.",
      },
      {
        title: "6. Return or Destruction of Confidential Information",
        text: "Upon expiration or request, the Receiving Party will destroy or return all Confidential Information.",
      },
      {
        title: "7. Proprietary Rights",
        text: "The Disclosing Party retains all intellectual property rights in its Confidential Information.",
      },
      {
        title: "8. Disclaimer",
        text: "ALL CONFIDENTIAL INFORMATION IS PROVIDED 'AS IS' WITHOUT WARRANTIES.",
      },
      {
        title: "9. Governing Law and Jurisdiction",
        text: `Governed by the laws of ${formData.governingLaw || "[State]"}. Any suit must be in ${formData.jurisdiction || "[Location]"}.`,
      },
      {
        title: "10. Equitable Relief",
        text: "A breach may cause irreparable harm for which monetary damages are insufficient.",
      },
      {
        title: "11. General",
        text: "Neither party may assign this MNDA without prior written consent.",
      },
    ];

    terms.forEach((term) => {
      addSubheading(term.title);
      addText(term.text);
      y += 3;
    });

    addText("Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under CC BY 4.0.", 8);

    doc.save(`mutual-nda-${new Date().toISOString().split("T")[0]}.pdf`);
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
            Mutual NDA Creator
          </h2>
          <p className="text-gray-600 text-sm">
            Chat with AI and watch your Mutual NDA update in real-time
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900">AI Chat</h3>
              <p className="text-sm text-gray-600 mt-1">
                This assistant currently supports Mutual NDA only.
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
                Status: {isReadyForReview ? "Ready for review" : "Collecting details"}
              </p>
              <p>Missing fields: {missingFields.length}</p>
              {chatError && <p className="text-red-600">Error: {chatError}</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Document Preview</h2>
              <button
                onClick={handleDownloadPdf}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium text-sm"
              >
                Download PDF
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded">
              <NDAPreview data={formData} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "[Date]";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}