import { Injectable, Logger } from '@nestjs/common';
import { Document } from '../documents/entities/document.entity';

// Exportar la interfaz para que pueda ser usada en otros archivos
export interface AnalysisResult {
  summary: string;
  keyPhrases: string[];
  entities: Array<{ text: string; type: string }>;
  sentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  statistics: {
    wordCount: number;
    characterCount: number;
    sentenceCount: number;
    paragraphCount: number;
  };
}

@Injectable()
export class DocumentAnalyzerService {
  private readonly logger = new Logger(DocumentAnalyzerService.name);

  /**
   * Analiza el contenido de un documento
   */
  async analyzeDocument(document: Document): Promise<AnalysisResult> {
    this.logger.log(`Analizando documento: ${document.id} - ${document.title}`);

    try {
      // Obtener el texto extraído del documento
      const text = this.getDocumentText(document);

      if (!text || text.trim().length === 0) {
        throw new Error('No hay texto disponible para analizar');
      }

      // Realizar análisis (simulado en esta fase)
      const summary = this.generateSummary(text);
      const keyPhrases = this.extractKeyPhrases(text);
      const entities = this.extractEntities(text);
      const sentiment = this.analyzeSentiment(text);
      const statistics = this.calculateStatistics(text);

      return {
        summary,
        keyPhrases,
        entities,
        sentiment,
        statistics,
      };
    } catch (error) {
      this.logger.error(
        `Error analizando documento ${document.id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Extrae el texto del documento
   */
  private getDocumentText(document: Document): string {
    if (!document.extractedContent) {
      return '';
    }

    // Si hay texto extraído, usarlo
    if (document.extractedContent.text) {
      return document.extractedContent.text;
    }

    // Si hay contenido en otra forma, intentar extraer texto
    if (document.extractedContent.content) {
      return document.extractedContent.content;
    }

    return '';
  }

  /**
   * Genera un resumen del texto (simulado)
   */
  private generateSummary(text: string): string {
    // En una implementación real, se usaría un algoritmo de NLP para resumir
    // Por ahora, tomamos las primeras frases (max 200 caracteres)
    const firstSentences = text.split(/[.!?]/).slice(0, 2).join('. ');
    return firstSentences.length > 200
      ? firstSentences.substring(0, 200) + '...'
      : firstSentences;
  }

  /**
   * Extrae frases clave (simulado)
   */
  private extractKeyPhrases(text: string): string[] {
    // Simulación simple - palabras de más de 5 letras que ocurren con frecuencia
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 5);

    const wordCount = new Map<string, number>();
    words.forEach((word) => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Obtener palabras que aparecen más de una vez y limitar a 5
    return [...wordCount.entries()]
      .filter(([_, count]) => count > 1)
      .sort(([_, countA], [__, countB]) => countB - countA)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Detecta entidades como nombres, organizaciones, etc. (simulado)
   */
  private extractEntities(text: string): Array<{ text: string; type: string }> {
    const entities = [];

    // Detectar posibles organizaciones
    const orgRegex = /([A-Z][a-zA-Z]+\s)+(Inc|LLC|Corp|SA|SRL|Company)/g;
    let match;
    while ((match = orgRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'organization' });
    }

    // Detectar fechas en formato español e inglés
    const dateRegex =
      /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+de\s+[a-zA-Zé]+\s+de\s+\d{2,4})\b/g;
    while ((match = dateRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'date' });
    }

    // Detectar cantidades monetarias
    const moneyRegex =
      /\$\s?\d+([.,]\d+)?|\d+([.,]\d+)?\s?€|\d+([.,]\d+)?\s?pesos/g;
    while ((match = moneyRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'money' });
    }

    // Detectar nombres de personas
    const nameRegex =
      /[A-Z][a-z]+\s[A-Z][a-z]+\s[A-Z][a-z]+|[A-Z][a-z]+\s[A-Z][a-z]+/g;
    while ((match = nameRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'person' });
    }

    return entities;
  }

  /**
   * Analiza el sentimiento del texto (simulado)
   */
  private analyzeSentiment(text: string): {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  } {
    // Lista simple de palabras positivas y negativas
    const positiveWords = [
      'bueno',
      'excelente',
      'increíble',
      'fantástico',
      'bien',
      'mejor',
      'éxito',
      'feliz',
    ];
    const negativeWords = [
      'malo',
      'terrible',
      'horrible',
      'peor',
      'fracaso',
      'problema',
      'dificultad',
      'triste',
    ];

    // Contar palabras positivas y negativas
    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter((word) =>
      positiveWords.includes(word),
    ).length;
    const negativeCount = words.filter((word) =>
      negativeWords.includes(word),
    ).length;

    // Calcular puntuación de sentimiento (-1 a 1)
    const totalWords = words.length || 1; // Evitar división por cero
    const score = (positiveCount - negativeCount) / totalWords;

    // Determinar etiqueta de sentimiento
    let label: 'positive' | 'negative' | 'neutral';
    if (score > 0.05) {
      label = 'positive';
    } else if (score < -0.05) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    return { score, label };
  }

  /**
   * Calcula estadísticas del texto
   */
  private calculateStatistics(text: string): {
    wordCount: number;
    characterCount: number;
    sentenceCount: number;
    paragraphCount: number;
  } {
    const characterCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
    const paragraphCount = text.split(/\n\s*\n/).filter(Boolean).length || 1;

    return {
      wordCount,
      characterCount,
      sentenceCount,
      paragraphCount,
    };
  }
}
