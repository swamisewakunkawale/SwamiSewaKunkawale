# Swami Samarth Kendra - Booking Portal Setup Guide

This is a Node.js + SQLite web application for sadhaks to register and book a 1-day service at the Swami Samarth Kendra.

## 1. Prerequisites (For Local Testing)
To test this on your computer before uploading to a server, you need to have **Node.js** installed on your laptop. 
Download it from: https://nodejs.org/

## 2. Before You Run (SMTP Setup)
1. Open `server.js` in a text editor (like Notepad or VS Code).
2. Go to **line 58** and **line 59**. Replace `YOUR_SMTP2GO_USERNAME` and `YOUR_SMTP2GO_PASSWORD` with your actual SMTP2GO credentials.
3. Go to **line 78** and replace `verified-email@yourdomain.com` with the email address you verified in SMTP2GO.
4. Save the file.

*(Note: The database and default users are created automatically. The admin is added with the email `admin@swamisamarth.org` and role `admin` in the `users` table).*

## 3. How to Run Locally
1. Open your terminal (Command Prompt / PowerShell / Terminal).
2. Navigate to this folder.
3. Run the following command to install required libraries:
   `npm install`
4. Run the following command to start the server:
   `node server.js`
5. Open your web browser and go to: `http://localhost:3000`

## 4. How to Access the Admin Panel
Once the site is running (either locally or on your host), you can access the admin settings, reports, and ad-hoc query page by visiting:
`http://your-website.com/sevaadmin` (or `http://localhost:3000/sevaadmin` locally)

## 5. Hosting Instructions

### Option A: Using Alwaysdata.com (Free)
1. Sign up for a free 100MB account at Alwaysdata.
2. Go to `Web -> Sites` in their dashboard and create a new **Node.js** application. Set the root directory to something like `/www/swami_samarth/`.
3. Go to `Files -> File Manager` (or FTP) and upload all files from this `.zip` folder into that directory.
4. Open the SSH Terminal in Alwaysdata, navigate to the folder (`cd www/swami_samarth`), and run `npm install`.
5. Restart your site from the dashboard. Your site is live! The SQLite database will safely persist on their servers.

### Option B: Using HostyCare / YouStable (cPanel - ₹59 to ₹249/mo)
1. Purchase a Node.js-supported cPanel plan.
2. Open cPanel and click on **Setup Node.js App**.
3. Create an application and select your domain name.
4. Go to the **File Manager** and upload/extract this `.zip` file into the application root folder you just created.
5. Go back to the Node.js App screen and click **Run NPM Install**. 
6. Click **Start App**. The site is live, and your database/images will be saved permanently on your NVMe SSD.
