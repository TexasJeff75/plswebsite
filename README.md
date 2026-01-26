# Deployment Tracker Dashboard

A comprehensive healthcare facility deployment tracking system built with React, TypeScript, Supabase, and Microsoft authentication.

## Features

- **Microsoft Authentication**: Secure login using Microsoft 365 credentials
- **Dashboard Overview**: Real-time metrics showing facility status, completion percentage, and upcoming go-lives
- **Facility Management**: Searchable, filterable table of all facilities with detailed information
- **Milestone Tracking**: Track 9 deployment milestones per facility with status updates
- **Equipment Management**: Monitor 4 device types per facility through deployment lifecycle
- **Map View**: Geographic visualization of facilities grouped by region
- **Timeline View**: Gantt-style timeline showing projected go-live dates by quarter
- **Notes & Comments**: Add notes and track facility history
- **Dark Theme**: Professional dark theme with teal (#00d4aa) accent color

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account
- Azure AD application for Microsoft authentication

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Configure Microsoft Authentication in Supabase:

   a. Go to your Supabase project dashboard

   b. Navigate to Authentication > Providers > Azure (Microsoft)

   c. Enable the Azure provider

   d. In Azure Portal (portal.azure.com):
      - Register a new application in Azure AD
      - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
      - Copy Application (client) ID
      - Create a client secret

   e. Enter the Azure credentials in Supabase:
      - Azure Application (client) ID
      - Azure Application (client) Secret
      - Azure AD Tenant URL (optional)

4. Run the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Database Schema

The application uses the following tables:

- **facilities**: Core facility information and status
- **milestones**: 9 deployment milestones per facility
- **equipment**: 4 device types per facility
- **notes**: Comments and notes on facilities
- **documents**: Document metadata and references
- **user_roles**: User permissions and roles
- **responsibilities**: Assignment tracking

## Deployment Milestones

1. Site Assessment Complete
2. CLIA Certificate Obtained
3. Lab Director Assigned
4. Equipment Shipped
5. Equipment Installed
6. Network/LIS Integration
7. Staff Training Complete
8. Competency Testing Done
9. Go-Live

## Equipment Types

1. Siemens epoc (blood gas analyzer)
2. Diatron Abacus 3 (CBC)
3. Clarity Platinum (urinalysis)
4. Cepheid GeneXpert (molecular respiratory)

## Usage

### Logging In

Use your Microsoft 365 credentials to sign in. First-time users will be automatically added to the system.

### Managing Facilities

- View all facilities in the Facilities page
- Filter by status, region, or phase
- Search by name, city, or state
- Click "View" to see detailed facility information

### Tracking Progress

- Update milestone status directly from the facility detail page
- Monitor equipment deployment status
- Add notes and comments for audit trail

### Viewing Analytics

- Dashboard shows real-time metrics
- Map view groups facilities by region
- Timeline view shows quarterly go-live schedule

## Technology Stack

- **Frontend**: React 18, TypeScript
- **Routing**: React Router 6
- **State Management**: TanStack Query (React Query)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Microsoft OAuth
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Development

The application follows a clean architecture with:

- `/src/components`: Reusable UI components
- `/src/pages`: Page-level components
- `/src/services`: API service layer
- `/src/hooks`: Custom React hooks
- `/src/contexts`: React context providers
- `/src/types`: TypeScript type definitions

## Security

- Row Level Security (RLS) enabled on all tables
- Microsoft OAuth for secure authentication
- JWT token management through Supabase
- Secure API calls with authentication headers

## Support

For issues or questions, please contact your system administrator.
