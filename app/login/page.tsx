import {authReadiness} from "@/lib/auth"
import {LoginForm} from "@/components/organisms/login-form"
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card"
export const dynamic="force-dynamic"
export default function Page(){return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6"><Card className="w-full max-w-md"><CardHeader><CardTitle className="text-2xl">Entre no TelemetryOS</CardTitle><CardDescription>Uma conta para acompanhar sua operação.</CardDescription></CardHeader><CardContent><LoginForm configured={authReadiness().enabled}/></CardContent></Card></main>}
