19:07:14.760 Running build in Washington, D.C., USA (East) – iad1
19:07:14.761 Build machine configuration: 2 cores, 8 GB
19:07:14.902 Cloning github.com/ahmedali20/UltraTeb-Dashboard (Branch: main, Commit: 113eb87)
19:07:15.744 Cloning completed: 841.000ms
19:07:15.995 Restored build cache from previous deployment (FY2Hwu4pkELrkoB1G5vWxMY9zzkv)
19:07:16.270 Running "vercel build"
19:07:16.288 Vercel CLI 58.1.0
19:07:16.535 Installing dependencies...
19:07:19.085 
19:07:19.085 up to date in 2s
19:07:19.087 
19:07:19.088 10 packages are looking for funding
19:07:19.088   run `npm fund` for details
19:07:19.118 Detected Next.js version: 14.2.35
19:07:19.122 Running "npm run build"
19:07:19.226 
19:07:19.226 > customers-dashboard@1.0.0 build
19:07:19.227 > next build
19:07:19.227 
19:07:19.932   ▲ Next.js 14.2.35
19:07:19.933 
19:07:19.953    Creating an optimized production build ...
19:07:27.166  ✓ Compiled successfully
19:07:27.167    Linting and checking validity of types ...
19:07:27.459 
19:07:27.460    We detected TypeScript in your project and reconfigured your tsconfig.json file for you. Strict-mode is set to false by default.
19:07:27.460    The following suggested values were added to your tsconfig.json. These values can be changed to fit your project's needs:
19:07:27.461 
19:07:27.461    	- include was updated to add '.next/types/**/*.ts'
19:07:27.461    	- plugins was updated to add { name: 'next' }
19:07:27.461 
19:07:36.868 Failed to compile.
19:07:36.869 
19:07:36.870 ./app/cheques/page.tsx:85:7
19:07:36.870 Type error: Type '{ initialCheques: any[]; canEdit: boolean; }' is not assignable to type 'IntrinsicAttributes & { invoices: Invoice[]; initialCollections: Collection[]; initialChequeAllocations: ChequeAllocation[]; initialWht: WhtCollection[]; canEdit: boolean; }'.
19:07:36.870   Property 'initialCheques' does not exist on type 'IntrinsicAttributes & { invoices: Invoice[]; initialCollections: Collection[]; initialChequeAllocations: ChequeAllocation[]; initialWht: WhtCollection[]; canEdit: boolean; }'.
19:07:36.871 
19:07:36.871   83 |   return (
19:07:36.871   84 |     <ChequesClient
19:07:36.871 > 85 |       initialCheques={cheques}
19:07:36.871      |       ^
19:07:36.871   86 |       canEdit={Boolean(session && hasDashboardPermission(session, "cheques", "edit"))}
19:07:36.872   87 |     />
19:07:36.872   88 |   );
19:07:36.909 Next.js build worker exited with code: 1 and signal: null
19:07:36.945 Error: Command "npm run build" exited with 1
