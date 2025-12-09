# 🚀 Deploy Agora Token Server to Render.com

## ✅ Prerequisites Completed
- ✅ Server code pushed to GitHub
- ✅ Render.yaml configuration created
- ✅ Environment variables configured

## 📋 Deployment Steps

### 1. Sign Up for Render.com
1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with your **GitHub account** (karr83sv2k25-ai)
4. No credit card required for free tier! 🎉

### 2. Create New Web Service
1. After login, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: **social-vibing-app**
3. Click **"Connect"** next to the repository

### 3. Configure the Service
Fill in the following details:

**Basic Settings:**
- **Name**: `social-vibing-token-server`
- **Region**: Choose closest to your users (e.g., Oregon, Ohio, Frankfurt)
- **Branch**: `main`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Environment Variables:**
Click **"Advanced"** → **"Add Environment Variable"** and add:

| Key | Value |
|-----|-------|
| `AGORA_APP_ID` | `6158a2b02c6a422aa3646ee2c116efb8` |
| `AGORA_APP_CERTIFICATE` | `0c17c48fdac84e63a2e2416d010bc1ef` |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |

**Instance Type:**
- Select **"Free"** plan (0.1 CPU, 512 MB RAM)

### 4. Deploy
1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Start the server
   - Provide a public URL

### 5. Get Your Server URL
After deployment (takes 2-3 minutes), you'll get a URL like:
```
https://social-vibing-token-server.onrender.com
```

### 6. Update Your React Native App
Once you have the URL, update `agoraConfig.js`:

```javascript
tokenServerUrl: 'https://social-vibing-token-server.onrender.com/api/agora/token'
```

### 7. Test the Deployment
Test the health endpoint:
```bash
curl https://social-vibing-token-server.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-10T...",
  "uptime": 123.456
}
```

## 🎯 Important Notes

### Free Tier Limitations
- ✅ **No credit card required**
- ✅ **750 hours/month free** (enough for 24/7 operation)
- ⚠️ **Spins down after 15 minutes of inactivity**
- ⚠️ **Cold start takes ~30 seconds** (first request after idle)

### Cold Start Handling
The free tier spins down after inactivity. To handle this:

1. **Option A**: Keep server warm with a cron job (upgrade to paid)
2. **Option B**: Add loading state in your app for first token request
3. **Option C**: Upgrade to paid plan ($7/month) for always-on

### Auto-Deploy
Render automatically redeploys when you push to the `main` branch! 🚀

## 🔧 Monitoring & Logs

### View Logs
1. Go to your Render dashboard
2. Click on **social-vibing-token-server**
3. Click **"Logs"** tab to see real-time logs

### Check Status
- Dashboard shows: CPU, Memory, Request count
- Health endpoint: `https://your-url.onrender.com/health`

## 🆘 Troubleshooting

### Build Fails
- Check that `server/` directory has all files
- Verify `package.json` has correct dependencies
- Check logs in Render dashboard

### Server Won't Start
- Verify environment variables are set correctly
- Check PORT is set to `10000`
- Review logs for error messages

### Token Generation Fails
- Verify `AGORA_APP_CERTIFICATE` is correct
- Check Agora console: https://console.agora.io
- Test health endpoint first

## 📱 Next Steps After Deployment

1. ✅ Get your Render URL
2. ✅ Update `agoraConfig.js` with the URL
3. ✅ Test voice calls in your app
4. ✅ Monitor logs for any errors

## 💰 Cost Information

**Free Tier:**
- 750 hours/month
- Enough for one always-running service
- Automatic SSL certificate
- Custom domain support

**Paid Plan ($7/month):**
- No spin down
- Better performance
- Priority support

---

## 🎉 Ready to Deploy!

Your code is ready. Just follow the steps above to deploy to Render.com!

**Deployment URL:** https://render.com/deploy

Need help? The Render documentation is excellent: https://render.com/docs
