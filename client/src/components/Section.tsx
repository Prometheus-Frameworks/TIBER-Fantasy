export const Section = ({ title, action }:{
  title:string; action?:React.ReactNode
}) => (
  <div className="mt-10 mb-3 flex items-end justify-between">
    <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
    {action}
  </div>
);