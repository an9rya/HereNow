# HereNow - Position Tracking System

A real-time position tracking application for monitoring the locations of people and vehicles. Built with Angular for the frontend and ASP.NET for the backend, HereNow provides comprehensive location tracking and management capabilities.

## Features

- **Real-Time Tracking**: Monitor the current positions of people and vehicles in real-time
- **Interactive Maps**: Visualize tracked entities on an interactive map interface
- **User Management**: Create and manage tracked entities with customizable settings
- **Geofencing**: Set up virtual boundaries and receive alerts when entities enter/exit zones
- **Multi-User Support**: Role-based access control for administrators and viewers
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **API-Driven Architecture**: RESTful API for flexible integrations

## Technology Stack

### Frontend
- **Framework**: Angular (version 21)
- **Styling**: CSS, Bootstrap
- **Maps**: Leaflet integration
- **HTTP Client**: Angular HttpClient

### Backend
- **Framework**: ASP.NET (Core 10)
- **Database**: SQL Server / SQLite (configurable)
- **ORM**: Entity Framework Core
- **API**: RESTful Web API
- **Authentication**: JWT/Identity
- **Real-Time**: SignalR (for live updates)

## Project Structure

```
HereNow/
├── frontend/                 # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # Reusable components
│   │   │   ├── services/     # Angular services
│   │   │   └── models/       # TypeScript interfaces
│   │   ├── assets/           # Images, icons, etc.
│   │   └── styles/           # Global styles
│   ├── angular.json
│   └── package.json
│
├── backend/                  # ASP.NET application
│   ├── HereNow.API/         # Web API project
│   ├── HereNow.Core/        # Domain models and business logic
│   ├── HereNow.Data/        # Database context and repositories
│   ├── HereNow.Services/    # Service layer
│   └── appsettings.json
│
└── README.md
```

## Prerequisites

### Frontend Requirements
- Node.js (v16 or higher)
- npm package manager
- Angular CLI (v17 or higher)

### Backend Requirements
- .NET 10 SDK
- SQL Server 2022+ or SQLite 
- Visual Studio 2026 or Visual Studio Code with C# extension

## Installation

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Restore NuGet packages**:
   ```bash
   dotnet restore
   ```

3. **Configure database connection**:
   - Update `appsettings.json` with your database connection string
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=localhost;Database=HereNow;User Id=sa;Password=YourPassword;"
   }
   ```

4. **Apply database migrations**:
   ```bash
   dotnet ef database update
   ```

5. **Build the project**:
   ```bash
   dotnet build
   ```

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API endpoint**:
   - Update `src/environments/environment.ts` with your backend API URL
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:5000/api'
   };
   ```

## Running the Application

### Start the Backend
```bash
cd backend
dotnet run
# API will be available at http://localhost:5000
```

### Start the Frontend
```bash
cd frontend
npm start
# or
ng serve
# Application will be available at http://localhost:4200
```

## Usage

1. **Access the Application**:
   - Open your browser and navigate to `http://localhost:4200`

2. **Login**:
   - Create an account or login with your credentials

3. **Add Entities to Track**:
   - Navigate to the management section
   - Create new tracked entities (people or vehicles)
   - Configure settings and assign to tracking groups

4. **Monitor Locations**:
   - View real-time positions on the interactive map
   - Click on entities to view detailed information
   - Access location history and analytics

5. **Set Geofences**:
   - Define geographic boundaries
   - Configure alerts and notifications
   - Monitor boundary crossings

## API Documentation

### Key Endpoints

**Positions**
- `GET /api/positions` - Get all tracked entities
- `GET /api/positions/{id}` - Get specific entity location
- `POST /api/positions` - Create new tracked entity
- `PUT /api/positions/{id}` - Update entity location
- `DELETE /api/positions/{id}` - Remove tracked entity

**Geofences**
- `GET /api/geofences` - Get all geofences
- `POST /api/geofences` - Create new geofence
- `DELETE /api/geofences/{id}` - Remove geofence

**Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

## Development

### Code Style
- Follow Angular style guide for frontend code
- Follow Microsoft C# coding conventions for backend code

### Running Tests

**Backend**:
```bash
dotnet test
```

**Frontend**:
```bash
npm test
```

## Deployment

### Docker Deployment
A `docker-compose.yml` file is available for containerized deployment:
```bash
docker-compose up -d
```

### Production Build

**Frontend**:
```bash
npm run build --prod
```

**Backend**:
```bash
dotnet publish -c Release -o ./publish
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Contact the development team
