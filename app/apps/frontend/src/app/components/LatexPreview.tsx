import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
}

export function LatexPreview({ content }: Props) {
  const rendered = useMemo(() => renderLatex(content), [content]);

  return (
    <div
      style={{ padding: '16px 24px', overflow: 'auto', height: '100%', fontFamily: 'serif', lineHeight: 1.8, fontSize: '14px' }}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function renderLatex(tex: string): string {
  let text = tex;

  // Remove comments
  text = text.replace(/%.*$/gm, '');

  // Remove \input, \usepackage, \documentclass, \begin{document}, \end{document}
  text = text.replace(/\\(input|usepackage|documentclass|bibliography|bibliographystyle|maketitle|newcommand|renewcommand|def|let|setlength|addtolength|setcounter|pagestyle|thispagestyle)\b[^\n]*/g, '');
  text = text.replace(/\\begin\{document\}/g, '');
  text = text.replace(/\\end\{document\}/g, '');

  // Handle title/author/date
  text = text.replace(/\\title\{([^}]*)\}/g, '<h1 style="text-align:center;margin:16px 0">$1</h1>');
  text = text.replace(/\\author\{([^}]*)\}/g, '<p style="text-align:center;color:#555">$1</p>');
  text = text.replace(/\\date\{([^}]*)\}/g, '<p style="text-align:center;color:#888;font-size:12px">$1</p>');

  // Handle sections
  text = text.replace(/\\section\*?\{([^}]*)\}/g, '<h2 style="margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px">$1</h2>');
  text = text.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3 style="margin:16px 0 6px">$1</h3>');
  text = text.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4 style="margin:12px 0 4px">$1</h4>');
  text = text.replace(/\\paragraph\*?\{([^}]*)\}/g, '<strong>$1</strong> ');

  // Handle abstract
  text = text.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, '<div style="margin:16px 32px;padding:12px;background:#f9f9f9;border-left:3px solid #1976d2"><strong>Abstract</strong><br/>$1</div>');

  // Handle environments: figure, table (simplified)
  text = text.replace(/\\begin\{figure\}[\s\S]*?\\caption\{([^}]*)\}[\s\S]*?\\end\{figure\}/g, '<div style="margin:12px 0;padding:8px;border:1px dashed #ccc;text-align:center;color:#666">[Figure: $1]</div>');
  text = text.replace(/\\begin\{table\}[\s\S]*?\\caption\{([^}]*)\}[\s\S]*?\\end\{table\}/g, '<div style="margin:12px 0;padding:8px;border:1px dashed #ccc;text-align:center;color:#666">[Table: $1]</div>');

  // Remove remaining figure/table environments without captions
  text = text.replace(/\\begin\{(figure|table)\*?\}(\[.*?\])?[\s\S]*?\\end\{\1\*?\}/g, '<div style="margin:8px 0;padding:8px;border:1px dashed #ccc;text-align:center;color:#888">[$1]</div>');

  // Handle itemize/enumerate
  text = text.replace(/\\begin\{(itemize|enumerate)\}/g, '<ul style="margin:8px 0;padding-left:24px">');
  text = text.replace(/\\end\{(itemize|enumerate)\}/g, '</ul>');
  text = text.replace(/\\item\s*/g, '<li>');

  // Handle display math: \[ ... \] and $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => renderMathBlock(math));
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => renderMathBlock(math));

  // Handle equation environments
  text = text.replace(/\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, (_, _env, math) => renderMathBlock(math));

  // Handle inline math: $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => renderMathInline(math));
  // Handle \( ... \)
  text = text.replace(/\\\((.*?)\\\)/g, (_, math) => renderMathInline(math));

  // Handle text formatting
  text = text.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  text = text.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  text = text.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  text = text.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  text = text.replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>');
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');

  // Handle citations and references
  text = text.replace(/\\cite[tp]?\*?\{([^}]*)\}/g, '<span style="color:#1976d2">[$1]</span>');
  text = text.replace(/\\ref\{([^}]*)\}/g, '<span style="color:#1976d2">[ref:$1]</span>');
  text = text.replace(/\\label\{[^}]*\}/g, '');
  text = text.replace(/\\footnote\{([^}]*)\}/g, '<sup style="color:#666;font-size:10px">($1)</sup>');

  // Handle line breaks
  text = text.replace(/\\\\/g, '<br/>');
  text = text.replace(/\\newline/g, '<br/>');
  text = text.replace(/\\vspace\{[^}]*\}/g, '<div style="height:12px"></div>');
  text = text.replace(/\\hspace\{[^}]*\}/g, ' ');

  // Remove remaining unknown commands
  text = text.replace(/\\(centering|noindent|small|large|Large|LARGE|huge|Huge|normalsize|footnotesize|scriptsize|tiny)\b/g, '');
  text = text.replace(/\\(clearpage|newpage|pagebreak|linebreak)\b/g, '<hr style="border:none;border-top:1px dashed #ddd;margin:16px 0"/>');

  // Convert double newlines to paragraphs
  text = text.replace(/\n\s*\n/g, '</p><p style="margin:8px 0;text-indent:2em">');

  // Wrap in paragraph
  text = '<p style="margin:8px 0;text-indent:2em">' + text + '</p>';

  // Clean up empty paragraphs
  text = text.replace(/<p[^>]*>\s*<\/p>/g, '');

  return text;
}

function renderMathBlock(math: string): string {
  try {
    const cleaned = math.replace(/\\label\{[^}]*\}/g, '').replace(/&/g, '&amp;').trim();
    const html = katex.renderToString(cleaned, { displayMode: true, throwOnError: false, trust: true });
    return `<div style="margin:12px 0;overflow-x:auto">${html}</div>`;
  } catch {
    return `<pre style="margin:12px 0;padding:8px;background:#f5f5f5;border-radius:4px;overflow-x:auto;font-size:12px">${escapeHtml(math)}</pre>`;
  }
}

function renderMathInline(math: string): string {
  try {
    const html = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, trust: true });
    return html;
  } catch {
    return `<code>${escapeHtml(math)}</code>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
