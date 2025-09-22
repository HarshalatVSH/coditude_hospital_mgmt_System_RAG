import { OpenAI } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RetrievalQAChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs/promises";
import path from "path";

export class RAGService {
  constructor() {
    this.llm = new OpenAI({
      temperature: 0.3,
      maxTokens: 300,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
    });

    this.vectorStore = null;
    this.qaChain = null;
    this.knowledgeBase = new Map();
    this.isInitialized = false;

    // Text splitter for chunking documents
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    });
  }

  async initialize() {
    try {
      console.log("🤖 Initializing RAG service...");

      // Load knowledge base documents
      await this.loadKnowledgeBase();

      // Create vector store
      await this.createVectorStore();

      // Setup QA chain
      this.setupQAChain();

      this.isInitialized = true;
      console.log("✅ RAG service initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing RAG service:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  async loadKnowledgeBase() {
    const knowledgeDir = path.join(process.cwd(), "src", "knowledge");

    try {
      // Ensure knowledge directory exists
      await fs.access(knowledgeDir);
    } catch (error) {
      console.log("📁 Creating knowledge directory...");
      await fs.mkdir(knowledgeDir, { recursive: true });
    }

    try {
      const files = await fs.readdir(knowledgeDir);
      const documents = [];

      console.log(`📚 Loading knowledge base from ${files.length} files...`);

      for (const file of files) {
        if (file.endsWith(".txt")) {
          const filePath = path.join(knowledgeDir, file);
          const content = await fs.readFile(filePath, "utf-8");
          const category = path.basename(file, ".txt");

          // Store in knowledge base map
          this.knowledgeBase.set(category, content);

          // Split content into chunks
          const chunks = await this.textSplitter.splitText(content);

          // Create documents for each chunk
          chunks.forEach((chunk, index) => {
            documents.push(
              new Document({
                pageContent: chunk,
                metadata: {
                  source: file,
                  category,
                  chunkIndex: index,
                  type: "knowledge_base",
                },
              })
            );
          });
        }
      }

      // Add dynamic content from database
      await this.addDynamicContent(documents);

      this.documents = documents;
      console.log(
        `✅ Loaded ${documents.length} knowledge chunks from ${files.length} files`
      );
    } catch (error) {
      console.error("❌ Error loading knowledge base:", error);
      this.documents = [];

      // Create default knowledge if no files exist
      await this.createDefaultKnowledge();
    }
  }

  async addDynamicContent(documents) {
    // Add current provider and clinic information
    const dynamicContent = [
      {
        content: `CURRENT WELLNESS PARTNERS PROVIDERS AND SCHEDULES:
        
        Dr. Sarah Johnson - Primary Care Physician
        Available: Monday-Friday 8am-5pm, Saturday 9am-12pm
        Specializes in: Family medicine, preventive care, annual physicals, chronic disease management
        
        Dr. Michael Chen - Cardiologist  
        Available: Tuesday-Thursday 9am-4pm
        Specializes in: Heart conditions, chest pain, hypertension, cardiac evaluations
        
        Dr. Lisa Rodriguez - Dermatologist
        Available: Monday, Wednesday, Friday 9am-3pm  
        Specializes in: Skin conditions, mole removal, skin cancer screening, cosmetic procedures
        
        Dr. James Wilson - Orthopedic Surgeon
        Available: Monday-Friday 8am-4pm
        Specializes in: Bone and joint issues, sports injuries, arthritis, fracture care
        
        Dr. Emily Davis - Pediatrician
        Available: Monday-Friday 9am-5pm, Saturday 9am-12pm
        Specializes in: Children's health, vaccinations, growth monitoring, adolescent medicine`,
        category: "current_providers",
      },
      {
        content: `WELLNESS PARTNERS CLINIC INFORMATION:
        
        Clinic Name: Wellness Partners
        Address: 123 Health Street, Medical City, MC 12345
        Main Phone: (555) 123-4567
        
        Hours of Operation:
        Monday-Friday: 8am-5pm (Primary Care, Specialists)
        Saturday: 9am-12pm (Primary Care, Pediatrics only)
        Sunday: Closed
        
        Urgent Care Hours:
        Monday-Friday: 8am-8pm
        Weekends: 9am-5pm
        
        Services Offered:
        - Primary Care and Family Medicine
        - Specialist Consultations (Cardiology, Dermatology, Orthopedics, Pediatrics)
        - Urgent Care for acute issues
        - Diagnostic Services (Lab work, Imaging)
        - Wellness Services (Nutrition, Physical Therapy, Mental Health)
        - Telemedicine appointments
        
        Facilities:
        - Wheelchair accessible
        - Free parking with validation
        - On-site laboratory
        - Digital X-ray capabilities
        - Patient portal access`,
        category: "clinic_information",
      },
    ];

    dynamicContent.forEach((item) => {
      // Split dynamic content into chunks too
      const chunks = item.content
        .split("\n\n")
        .filter((chunk) => chunk.trim().length > 0);

      chunks.forEach((chunk, index) => {
        documents.push(
          new Document({
            pageContent: chunk.trim(),
            metadata: {
              source: "database",
              category: item.category,
              chunkIndex: index,
              type: "dynamic_content",
            },
          })
        );
      });
    });
  }

  async createDefaultKnowledge() {
    console.log("📝 Creating default knowledge base...");

    const defaultKnowledge = `WELLNESS PARTNERS BASIC INFORMATION:
    
    Wellness Partners is a multi-specialty health clinic providing comprehensive medical care.
    
    We offer appointment scheduling for primary care, specialist consultations, and urgent care visits.
    
    Our scheduling policies require 24-hour notice for cancellations to avoid fees.
    
    New patients should arrive 20 minutes early, returning patients 15 minutes early.
    
    We accept most major insurance plans and offer self-pay options.`;

    this.documents = [
      new Document({
        pageContent: defaultKnowledge,
        metadata: {
          source: "default",
          category: "basic_info",
          type: "default_knowledge",
        },
      }),
    ];
  }

  async createVectorStore() {
    try {
      if (this.documents && this.documents.length > 0) {
        console.log("🔗 Creating vector store with embeddings...");

        this.vectorStore = await FaissStore.fromDocuments(
          this.documents,
          this.embeddings
        );

        console.log("✅ Vector store created successfully");
      } else {
        console.warn("⚠️ No documents available for vector store creation");
      }
    } catch (error) {
      console.error("❌ Error creating vector store:", error);
      throw error;
    }
  }

  setupQAChain() {
    if (!this.vectorStore) {
      console.warn("⚠️ Vector store not available, QA chain not created");
      return;
    }

    const template = `You are Riley, the friendly appointment scheduling assistant for Wellness Partners clinic. Use the following context to answer the question accurately and helpfully.

Context: {context}

Question: {question}

Instructions for Riley:
- Always be warm, professional, and helpful
- Focus on appointment scheduling and clinic information
- Spell out all numbers for voice responses (twenty not 20, two thirty PM not 2:30 PM)
- Keep responses conversational and concise
- If you don't have specific information, offer to help find it or transfer to a human
- Never use bullet points, special characters, or emojis in responses
- Always end with an offer to help further

Answer as Riley:`;

    const prompt = PromptTemplate.fromTemplate(template);

    this.qaChain = RetrievalQAChain.fromLLM(
      this.llm,
      this.vectorStore.asRetriever({
        k: 4, // Return top 4 most relevant chunks
        searchType: "similarity",
        searchKwargs: {
          filter: undefined, // Can add metadata filters here if needed
        },
      }),
      {
        prompt,
        returnSourceDocuments: true,
        verbose: process.env.NODE_ENV === "development",
      }
    );

    console.log("🔗 QA chain configured successfully");
  }

  async queryKnowledge(question, context = {}) {
    try {
      if (!this.isInitialized || !this.qaChain) {
        console.warn("⚠️ RAG service not initialized, using fallback");
        return {
          answer:
            "I'm having trouble accessing our knowledge base right now, but I'd be happy to help you with appointment scheduling. What can I do for you today?",
          sources: [],
          confidence: 0,
        };
      }

      // Enhance the question with context if available
      let enhancedQuestion = question;
      if (context.intent) {
        enhancedQuestion = `Intent: ${context.intent}. User question: ${question}`;
      }

      console.log(`🔍 Querying knowledge base: "${question}"`);

      const result = await this.qaChain.call({
        query: enhancedQuestion,
      });

      const confidence = this.calculateConfidence(result.sourceDocuments);

      console.log(
        `✅ Knowledge query completed with confidence: ${confidence}`
      );

      return {
        answer: result.text,
        sources:
          result.sourceDocuments?.map((doc) => ({
            content: doc.pageContent.substring(0, 200) + "...",
            category: doc.metadata.category,
            source: doc.metadata.source,
            score: doc.metadata.score || 0,
          })) || [],
        confidence,
      };
    } catch (error) {
      console.error("❌ Error querying knowledge base:", error);
      return {
        answer:
          "I apologize, but I'm having trouble processing your question right now. Let me help you with general appointment scheduling information instead.",
        sources: [],
        confidence: 0,
      };
    }
  }

  calculateConfidence(sourceDocuments) {
    if (!sourceDocuments || sourceDocuments.length === 0) return 0;

    // Simple confidence calculation based on source relevance
    // This can be enhanced with more sophisticated scoring
    const avgScore =
      sourceDocuments.reduce((sum, doc) => {
        return sum + (doc.metadata.score || 0.5);
      }, 0) / sourceDocuments.length;

    return Math.round(avgScore * 100);
  }

  // Search for specific information without QA chain
  async searchKnowledge(query, category = null) {
    try {
      if (!this.vectorStore) {
        return [];
      }

      let filter = {};
      if (category) {
        filter = { category };
      }

      const results = await this.vectorStore.similaritySearch(query, 4, filter);

      return results.map((doc) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      }));
    } catch (error) {
      console.error("❌ Error searching knowledge base:", error);
      return [];
    }
  }

  // Get knowledge by category
  getKnowledgeByCategory(category) {
    return this.knowledgeBase.get(category) || null;
  }

  // Refresh the vector store (useful for updating knowledge)
  async refreshKnowledge() {
    try {
      console.log("🔄 Refreshing knowledge base...");
      await this.loadKnowledgeBase();
      await this.createVectorStore();
      this.setupQAChain();
      console.log("✅ Knowledge base refreshed successfully");
      return true;
    } catch (error) {
      console.error("❌ Error refreshing knowledge base:", error);
      return false;
    }
  }

  // Check if RAG service is ready
  isReady() {
    return this.isInitialized && this.vectorStore && this.qaChain;
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.isInitialized,
      hasVectorStore: !!this.vectorStore,
      hasQAChain: !!this.qaChain,
      documentCount: this.documents?.length || 0,
      knowledgeCategories: Array.from(this.knowledgeBase.keys()),
    };
  }
}
