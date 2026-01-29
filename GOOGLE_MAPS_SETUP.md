# Google Maps Setup for Deployment Tracker

The Deployment Tracker now uses **Google Maps** instead of MapLibre GL for better reliability and features.

## Why Google Maps?

- ✅ More reliable and widely supported
- ✅ Better performance and stability
- ✅ Native browser compatibility
- ✅ Superior documentation
- ✅ $200/month free credit (covers ~28,000 map loads)

## Setup Instructions

### 1. Get Your Google Maps API Key

1. **Go to Google Cloud Console**
   Visit: [https://console.cloud.google.com/google/maps-apis](https://console.cloud.google.com/google/maps-apis)

2. **Create or Select a Project**
   - If you don't have a project, create one
   - Give it a meaningful name like "Proximity Deployment Tracker"

3. **Enable the Maps JavaScript API**
   - Navigate to **"APIs & Services" → "Library"**
   - Search for **"Maps JavaScript API"**
   - Click on it and press **"Enable"**

4. **Create an API Key**
   - Go to **"APIs & Services" → "Credentials"**
   - Click **"Create Credentials" → "API Key"**
   - Copy the generated API key

### 2. Add API Key to Your Project

Open your `.env` file in the project root and update:

```env
VITE_GOOGLE_MAPS_API_KEY=paste_your_actual_api_key_here
```

Replace `YOUR_API_KEY_HERE` with the API key you copied from Google Cloud Console.

### 3. Restart Development Server

After updating the `.env` file:

```bash
npm run dev
```

The map should now load successfully!

## Features

The Google Maps implementation includes:

- **🎯 Color-coded markers** - Red (blocked/not started), Yellow (in progress), Green (live)
- **🖱️ Interactive tooltips** - Hover over markers to see facility details
- **📍 Click to view details** - Opens comprehensive facility panel
- **🔍 Search and filter** - By status, region, or facility name
- **🗺️ Map controls** - Zoom, pan, fit to facilities, reset view
- **⛶ Fullscreen mode** - Expand for better viewing
- **📊 Status legend** - Color guide always visible
- **📁 Import data** - Bulk upload facilities

## Status Colors

- 🔴 **Red** - Blocked or Not Started
- 🟡 **Yellow** - In Progress
- 🟢 **Green** - Live/Complete
- ⚪ **Gray** - Not Started

## API Key Security

**⚠️ Important Security Notes:**

### Development
- The `.env` file is in your `.gitignore` (never commit it!)
- Your API key is only visible during local development

### Production
- Set `VITE_GOOGLE_MAPS_API_KEY` in your hosting platform's environment variables
- Never hardcode the API key in your source code

### Recommended: Restrict Your API Key

To prevent unauthorized use and unexpected charges:

1. Go to **Google Cloud Console → Credentials**
2. Click on your API key
3. Under **"Application restrictions"**:
   - For development: Select "HTTP referrers"
   - Add `http://localhost:*` and `http://127.0.0.1:*`
   - For production: Add your actual domain(s)
4. Under **"API restrictions"**:
   - Select "Restrict key"
   - Choose only **"Maps JavaScript API"**
5. Click **"Save"**

## Cost Information

Google Maps pricing is generous for most use cases:

- **Free tier**: $200 monthly credit
- **Map loads**: ~28,000 free loads per month
- **Pricing beyond free tier**: $7 per 1,000 loads

For a deployment tracker with moderate usage, you'll likely stay within the free tier.

[View detailed pricing](https://mapsplatform.google.com/pricing/)

## Troubleshooting

### Map Not Loading?

**Check these common issues:**

1. ✅ API key is correctly set in `.env`
2. ✅ Maps JavaScript API is enabled in Google Cloud Console
3. ✅ No browser console errors
4. ✅ API key restrictions don't block localhost (for development)
5. ✅ Development server was restarted after updating `.env`

**Still not working?** Check the browser console (F12) for specific error messages.

### Markers Not Showing?

1. Facilities must have valid `latitude` and `longitude` values
2. Check that data is loading (open browser console)
3. Try the "Fit to Facilities" button (target icon)
4. Verify facilities aren't filtered out

### InfoWindow Shows Wrong Data?

- This is usually a caching issue
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache if needed

### API Key Errors?

**"This page can't load Google Maps correctly"**
- Your API key is invalid or not properly set
- Check for typos in the `.env` file
- Ensure the Maps JavaScript API is enabled

**"This API project is not authorized to use this API"**
- Enable the Maps JavaScript API in Google Cloud Console

**"RefererNotAllowedMapError"**
- Your domain is not authorized in the API key restrictions
- Update restrictions to include your domain or temporarily remove them for testing

## Support

For Google Maps API issues:
- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Google Cloud Console](https://console.cloud.google.com)
- [Stack Overflow - google-maps-api-3](https://stackoverflow.com/questions/tagged/google-maps-api-3)

For Deployment Tracker issues:
- Check the browser console for errors
- Review facility data in the database
- Ensure all dependencies are installed (`npm install`)
