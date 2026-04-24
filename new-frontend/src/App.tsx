import AuthenticatedLayout from "./components/AuthenticatedLayout"
import HelloWorldPage from "./pages/HelloWorldPage"

export default function App() {
  return (
    <AuthenticatedLayout>
      <HelloWorldPage />
    </AuthenticatedLayout>
  )
}
