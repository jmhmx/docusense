# Backend del Proyecto Docusense

## Descripción

Este repositorio contiene el código del backend del proyecto Docusense, una aplicación para la gestión segura y eficiente de documentos con funcionalidades de firma digital, biometría y blockchain.

El backend está desarrollado con [NestJS](https://nestjs.com/), un framework de Node.js que utiliza TypeScript. Proporciona las APIs RESTful para la gestión de usuarios, documentos, firmas y operaciones relacionadas con blockchain y biometría.

## Dependencias Principales

- **NestJS:** Framework para la construcción del backend.
- **TypeORM:** ORM para la interacción con la base de datos.
- **PostgreSQL:** Base de datos utilizada.
- **Passport:** Para la autenticación y autorización.
- **Bcrypt:** Para la encriptacion de contraseñas.
- **dotenv:** Para el uso de variables de entorno.
- **winston:** Para el uso de logs.

## Configuración

1.  **Variables de entorno:**

    - Crea un archivo `.env` en la raíz del proyecto `backend`.
    - Define las variables de entorno necesarias:

          DATABASE_URL=postgres://user:password@host:port/database
          JWT_SECRET=your_secret_key
          PORT=3000

    2. **Base de datos:**

    - Asegúrate de tener PostgreSQL instalado y en ejecución.
    - Crea la base de datos especificada en `DATABASE_URL`.

## Instalación

bash cd backend npm install

## Ejecución

### Modo Desarrollo

bash npm run start:dev

### Modo Producción

bash npm run build npm run start:prod

## Endpoints

- **/auth:** Endpoints relacionados con la autenticación.
- **/users:** Endpoints relacionados con la gestion de usuarios.
- **/documents:** Endpoints relacionados con la gestion de documentos.

## Pruebas

### Pruebas Unitarias

bash npm run test

### Pruebas E2E

## Arquitectura

El backend sigue una arquitectura modular, dividida en:

- **Modulos:** Cada funcionalidad se encuentra encapsulada dentro de un módulo (ej. `AuthModule`, `UsersModule`, `DocumentsModule`).
- **Controladores:** Manejan las solicitudes HTTP y devuelven las respuestas.
- **Servicios:** Contienen la lógica de negocio.
- **Entidades:** Representan las tablas de la base de datos.
- **DTO's:** Objetos utilizados para la transferencia de datos.
