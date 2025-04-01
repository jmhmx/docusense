Comandos Clave

1. Construir y levantar todos los servicios:
   docker-compose up -d --build

Detener todos los servicios:
docker-compose down

Ver logs específicos (ej: backend):
docker logs docusense_api -f

```
docusense
├─ .docker
│  ├─ nginx
│  └─ postgres
├─ .env
├─ backend
│  ├─ .eslintrc.js
│  ├─ .prettierrc
│  ├─ Dockerfile
│  ├─ nest-cli.json
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ README.md
│  ├─ src
│  │  ├─ app.controller.spec.ts
│  │  ├─ app.controller.ts
│  │  ├─ app.module.ts
│  │  ├─ app.service.ts
│  │  ├─ auth
│  │  ├─ documents
│  │  ├─ global.d.ts
│  │  ├─ health
│  │  │  └─ health.controller.ts
│  │  ├─ main.ts
│  │  └─ users
│  ├─ test
│  │  ├─ app.e2e-spec.ts
│  │  └─ jest-e2e.json
│  ├─ tsconfig.build.json
│  └─ tsconfig.json
├─ docker-compose.yml
├─ frontend
│  ├─ Dockerfile
│  ├─ eslint.config.js
│  ├─ index.html
│  ├─ nginx
│  │  └─ nginx.conf
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  └─ vite.svg
│  ├─ README.md
│  ├─ src
│  │  ├─ api
│  │  │  └─ client.ts
│  │  ├─ App.css
│  │  ├─ App.tsx
│  │  ├─ assets
│  │  │  └─ react.svg
│  │  ├─ index.css
│  │  ├─ main.tsx
│  │  └─ vite-env.d.ts
│  ├─ tsconfig.app.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
├─ Idea.docx
├─ Plan Técnico.docx
└─ README.md

```

Basado en el **Plan Técnico.docx** y tu estructura actual, **plan de trabajo (4 semanas)** para un desarrollador fullstack, priorizando funcionalidades clave y optimizando tiempo:

---

### **Semana 1: Base Fundamental (MVP Core)**

**Objetivo**: Autenticación + Subida básica de documentos  
**Horas diarias**: 8h (40h/semana)

| **Día**       | **Tarea Backend** (4h/día)               | **Tarea Frontend** (4h/día)                      | **Entregable**               |
| ------------- | ---------------------------------------- | ------------------------------------------------ | ---------------------------- |
| **Lunes**     | Configurar módulo `Auth` (JWT + bcrypt)  | Crear pantallas Login/Register (React Hook Form) | Usuarios pueden registrarse  |
| **Martes**    | Implementar `Documents` entity (TypeORM) | Componente `FileUploader` (drag & drop)          | Esquema DB para documentos   |
| **Miércoles** | API para subir PDFs (Multer + FS)        | Conexión API + manejo de errores                 | Subida de archivos funcional |
| **Jueves**    | Integración básica con SAT (SOAP)        | Tabla de documentos subidos (React Table)        | Listado de documentos        |
| **Viernes**   | Testing E2E (Jest + Supertest)           | Testing componentes (Vitest)                     | Suite de pruebas básica      |

---

### **Semana 2: Flujo de Firma Electrónica**

**Objetivo**: Firmas digitales + Vista previa de PDF  
| **Día** | **Backend** | **Frontend** | **Entregable** |
|---------|------------|--------------|----------------|
| **Lunes** | Servicio de firma digital (PDFKit) | Componente `PDFViewer` (react-pdf) | Vista previa de PDF |
| **Martes** | API para añadir firmas (coordenadas X,Y) | Lógica de arrastrar firmas (DnD) | Firmas posicionables |
| **Miércoles** | Guardar documentos firmados (S3 local) | Contexto de sesión (Zustand) | Persistencia de firmas |
| **Jueves** | Integración con PAC de prueba (FIEL) | Flujo paso a paso (Wizard) | UI de firma guiada |
| **Viernes** | Optimizar almacenamiento (Redis cache) | Panel de actividades (Timeline) | Historial de acciones |

---

### **Semana 3: Integración SAT + Blockchain**

**Objetivo**: Validez legal + Auditoría  
| **Día** | **Backend** | **Frontend** | **Entregable** |
|---------|------------|--------------|----------------|
| **Lunes** | Conexión SOAP con SAT (CFDI) | Componente `SATStatus` (badges) | Estado de documentos SAT |
| **Martes** | Sellado de tiempo (Hyperledger) | Integración con MetaMask (Web3) | Hash en blockchain |
| **Miércoles** | Servicio de notificaciones (Webhooks) | Panel de alertas (Toast) | Notificaciones en UI |
| **Jueves** | API para generación de PDF firmado | Botón "Exportar a PDF" | Documentos descargables |
| **Viernes** | Stress testing (Artillery) | Optimización de rendimiento | Reporte de métricas |

---

### **Semana 4: Pulido y Despliegue**

**Objetivo**: Preparar para producción  
| **Día** | **Tarea** | **Detalle** | **Entregable** |
|---------|----------|-------------|----------------|
| **Lunes** | CI/CD pipeline (GitLab) | Build + test + deploy automático | `.gitlab-ci.yml` |
| **Martes** | Dockerizar para producción | Optimizar imágenes (multi-stage) | Dockerfiles finales |
| **Miércoles** | Documentación Swagger | Postman collection | API documentada |
| **Jueves** | Seguridad (Helmet + CORS) | Validación de formularios | Protección básica |
| **Viernes** | Demo interno + ajustes | Feedback de stakeholders | MVP listo para deploy |

---

### **Priorización Táctica**

1. **Funcionalidades Críticas**:

   - Autenticación JWT
   - Subida/descarga de PDFs
   - Firma básica con coordenadas

2. **Opcionales para V2**:

   - Biometría avanzada
   - Dashboard analítico
   - Integración con Aspel

3. **Herramientas Clave**:
   - **Backend**: NestJS + TypeORM + Jest
   - **Frontend**: React + Vite + @tanstack/react-query
   - **DevOps**: Docker + GitLab CI

---
