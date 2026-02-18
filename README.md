# CSCE482_Koopalings
Capstone Project

# Event Social App (Capstone)

A social app where users can **create events**, **discover nearby events**, and **RSVP** to meet new people based on **location** and **hobbies**.

## Features
**Core (MVP)**
- Create and post events (time, location, details, capacity, etc.)
- Browse/search events with filters (category, distance, time)
- RSVP to events (Interested / Going)
- Join groups/chats (basic version)

**Planned**
- Private messaging
- “Aura points” / ratings after meeting

## Tech Stack
- Backend: Node.js + PostgreSQL
- Frontend: (team choice)


## Requirements
- Download Node.js
- For windows users: download android studio, create a project, and add a running device
- Commands to run the project:
- cd village
- npm run android
- or run npx expo start
- change const API_URL = (at the top of each page) to own ip 
- IP can be found by running ipconfig  on terminal and looking for IPv4 Address (add :3000 after)
- Example: const API_URL = 'http://10.247.66.130:3000';
- In seperate terminal cd into village-backend and run: npm run dev