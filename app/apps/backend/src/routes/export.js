import { markdownToLatex, latexToMarkdown, latexToPdf, markdownToPdf } from '../services/exportService.js';

export function registerExportRoutes(fastify) {
  fastify.post('/api/export/md-to-latex', async (request) => {
    const { projectPath, inputFile } = request.body;
    return await markdownToLatex(projectPath, inputFile);
  });

  fastify.post('/api/export/latex-to-md', async (request) => {
    const { projectPath, inputFile } = request.body;
    return await latexToMarkdown(projectPath, inputFile);
  });

  fastify.post('/api/export/latex-to-pdf', async (request) => {
    const { projectPath, inputFile, engine } = request.body;
    return await latexToPdf(projectPath, inputFile, engine);
  });

  fastify.post('/api/export/md-to-pdf', async (request) => {
    const { projectPath, inputFile, engine } = request.body;
    return await markdownToPdf(projectPath, inputFile, engine);
  });
}
