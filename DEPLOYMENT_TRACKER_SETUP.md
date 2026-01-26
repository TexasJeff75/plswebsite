# Deployment Tracker - Setup Guide

## Overview

A comprehensive deployment tracking system with Microsoft Authentication for managing medical facilities deployment with milestones, equipment, notes, documents, and team assignments.

## Features Implemented

### ✅ Authentication & Authorization
- Microsoft OAuth integration via Supabase Auth
- Role-based access control (Admin, Editor, Viewer)
- Protected routes
- User profile management
- Automatic user profile creation on signup

### ✅ Dashboard
- Key metrics (total facilities, live, in progress, blocked)
- Overall completion progress bar
- Upcoming go-lives (next 30 days)
- Blocked items alert panel
- Real-time statistics

### ✅ Facilities Management
- List view with filtering (status, region, phase, search)
- Facility detail pages
- Progress tracking
- Location information
- Go-live date tracking

### ✅ Milestone Tracking
- 9 deployment checkpoints per facility
- Status management (Not Started, In Progress, Complete, Blocked)
- Date tracking (start date, completion date)
- Visual progress indicators

### ✅ Equipment Management
- Device tracking (Siemens epoc, Diatron Abacus 3, Clarity Platinum, Cepheid GeneXpert)
- Status workflow (Ordered → Shipped → Delivered → Installed → Validated → Trained)
- Serial number tracking

### ✅ User Management (Admin Only)
- View all users
- Assign/change user roles
- Permission descriptions
- User activity tracking

### ✅ Dark Theme with Teal Accents
- Professional dark slate background (#0F172A)
- Teal primary color (#00d4aa)
- Consistent color palette throughout
- Status-based color coding

## Database Schema

The system uses the following Supabase tables:

- **user_roles**: User authentication and role management
- **facilities**: Core facility information
- **milestones**: Deployment checkpoints
- **equipment**: Device tracking
- **notes**: Comments and updates
- **documents**: File metadata
- **responsibilities**: Team assignments

All tables have Row Level Security (RLS) enabled with role-based policies.

## Setup Instructions

### 1. Configure Microsoft OAuth in Azure AD

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Set the name (e.g., "Deployment Tracker")
5. Set redirect URI: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
6. After creation, note the **Application (client) ID**
7. Go to **Certificates & secrets** → **New client secret**
8. Note the secret value immediately (it won't be shown again)
9. Go to **API permissions** → **Add a permission**
10. Select **Microsoft Graph** → **Delegated permissions**
11. Add: `email`, `openid`, `profile`

### 2. Configure Supabase Auth

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Providers**
3. Enable **Azure** provider
4. Enter your Azure AD **Client ID** and **Client Secret**
5. Set the **Azure Tenant URL**: `https://login.microsoftonline.com/[YOUR-TENANT-ID]`
   - For multi-tenant: use `https://login.microsoftonline.com/common`
6. Save the settings

### 3. Database Setup

The database schema is already created via migrations. Verify tables exist:

```sql
-- Check tables
SELECT * FROM user_roles;
SELECT * FROM facilities;
SELECT * FROM milestones;
SELECT * FROM equipment;
```

### 4. Create Your First Admin User

After first login, manually set your user as Admin:

```sql
UPDATE user_roles
SET role = 'Admin'
WHERE email = 'your-email@domain.com';
```

### 5. Environment Variables

Verify your `.env` file contains:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 6. Build and Deploy

```bash
npm install
npm run build
```

Deploy the `dist` folder to your hosting platform.

## Access the Application

Navigate to `/tracker.html` to access the deployment tracker:

```
https://your-domain.com/tracker.html
```

## User Roles

### Admin
- Full system access
- Manage all facilities, milestones, equipment
- Assign user roles
- Delete records

### Editor
- Create and edit facilities
- Update milestones and equipment
- Upload documents
- Add notes

### Viewer
- Read-only access
- View all facilities and data
- Cannot make changes

## Usage

### First Time Setup

1. Navigate to the tracker application
2. Click "Sign in with Microsoft"
3. Authenticate with Microsoft 365/Azure AD credentials
4. First user should be manually promoted to Admin (see step 4 above)
5. Admin can then assign roles to other users

### Dashboard Navigation

- **Dashboard**: Overview metrics and alerts
- **Facilities**: List and manage all facilities
- **Users** (Admin only): Manage user roles

### Managing Facilities

1. Click on any facility to view details
2. Update milestone status from dropdown (Editor/Admin)
3. Update equipment status (Editor/Admin)
4. View all facility information, location, and dates

### Filtering Facilities

Use the filter bar to:
- Search by facility name
- Filter by status (Not Started, In Progress, Live, Blocked)
- Filter by region
- Filter by phase

## Technical Stack

- **Frontend**: React 19 with JSX
- **Routing**: React Router DOM
- **State Management**: React Context + TanStack Query
- **Styling**: Tailwind CSS (dark theme)
- **Authentication**: Supabase Auth (Microsoft OAuth)
- **Database**: Supabase (PostgreSQL with RLS)
- **Build Tool**: Vite

## Security Features

- Row Level Security on all tables
- Role-based access control
- Protected routes
- Secure authentication via Microsoft OAuth
- Session management
- HTTPS required for production

## Support & Troubleshooting

### Issue: Can't sign in with Microsoft
- Verify Azure AD app registration is correct
- Check redirect URI matches Supabase callback URL
- Ensure Microsoft Graph API permissions are granted

### Issue: No data showing
- Check browser console for errors
- Verify RLS policies allow access
- Ensure user has proper role assigned

### Issue: Permission denied errors
- Check user role in database
- Verify RLS policies are correctly configured
- Try refreshing the page to reload user session

## Future Enhancements

The following features are ready for implementation:

- Map visualization with geographic plotting
- Gantt timeline view for project scheduling
- Rich text notes with mentions
- Document upload and management
- Responsibility assignment workflow
- Export to CSV/Excel/PDF
- Mobile-optimized views
- Email notifications for milestone changes
- Activity history tracking
- Advanced filtering and search

## License

Proprietary - Proximity Lab Services, LLC
