'use server'
import puppeteer from 'puppeteer';
import { marked } from 'marked';

export async function convertMdToPdf(mdText: string, title: string): Promise<string> {
    const docTitle = title.replaceAll(" ", "_");
    
    try {
        // Convert markdown to HTML
        const html = marked(mdText);
        
        // Create full HTML document
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                        line-height: 1.6;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 2rem;
                        color: #333;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        margin-top: 2rem;
                        margin-bottom: 1rem;
                        color: #2c3e50;
                    }
                    h1 { font-size: 2.5rem; border-bottom: 3px solid #3498db; padding-bottom: 0.5rem; }
                    h2 { font-size: 2rem; border-bottom: 2px solid #95a5a6; padding-bottom: 0.3rem; }
                    h3 { font-size: 1.5rem; }
                    code {
                        background: #f8f9fa;
                        padding: 0.2rem 0.4rem;
                        border-radius: 3px;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    }
                    pre {
                        background: #f8f9fa;
                        padding: 1rem;
                        border-radius: 5px;
                        overflow-x: auto;
                        border-left: 4px solid #3498db;
                    }
                    blockquote {
                        border-left: 4px solid #bdc3c7;
                        margin: 1rem 0;
                        padding-left: 1rem;
                        color: #7f8c8d;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 1rem 0;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 0.5rem;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        // Set content and generate PDF
        await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
        
        const pdfPath = `./public/outputs/pdfs/${docTitle}.pdf`;
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        });
        
        await browser.close();
        
        console.log("Converted markdown text to PDF:", pdfPath);
        return pdfPath;
        
    } catch (err) {
        console.error(err);
        return "Impossible to convert your file to PDF at the moment: try again soon!";
    }
}