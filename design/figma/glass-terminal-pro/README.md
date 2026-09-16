# OwnTerm Desktop

Create a high-fidelity desktop application prototype called OwnTerm.

Tech:

- React

- TypeScript

- Tailwind CSS

- Lucide React icons

- Frontend only

- No database, authentication, Supabase, or backend

Viewport:

- Desktop-first, designed at 1600x900

- The interface must fill the entire viewport

- It should look like a native Windows desktop application, not a website

Visual direction:

- Use the attached OwnTerm mockup as the primary visual reference

- Dark acrylic/glass appearance

- Graphite and near-black surfaces

- Purple accent color #A970FF

- Subtle borders using white at low opacity

- Soft shadows and restrained backdrop blur

- Compact spacing similar to Windows Terminal

- Avoid excessive gradients, glowing effects, and large rounded cards

Layout:

1. Integrated native-style title bar

2. Terminal tabs inside the title bar

3. Narrow vertical navigation rail

4. Connections sidebar with:

   - Search field

   - Favorites

   - Recent connections

   - Online/offline indicators

5. Main terminal area

6. Session toolbar

7. Quick commands floating panel

8. Compact connection status bar at the bottom

Terminal:

- Use a realistic simulated terminal

- Use Cascadia Code or a monospace fallback

- Add sample SSH and Docker command output

- Do not implement a real terminal yet

Interactions:

- Switch between terminal tabs

- Select different SSH hosts

- Collapse and expand the connections sidebar

- Open and close the quick commands panel

- Add hover, selected, connected, and disconnected states

- Keep all mock data in local TypeScript objects

Code organization:

- Separate reusable components

- TitleBar

- TerminalTabs

- NavigationRail

- ConnectionsSidebar

- HostRow

- SessionToolbar

- TerminalView

- QuickCommands

- StatusBar

The result should be suitable for later integration into a Tauri 2 desktop application.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0c08ad87-1435-4876-b36a-cdb2edef0b52).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
