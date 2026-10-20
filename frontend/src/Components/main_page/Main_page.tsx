import { NavLink } from 'react-router-dom'
import Robot from '../robot/Robot'

export default function Main_page() {
    return (
        <div className="custom-bg min-vh-100 d-flex align-items-center">
            <div className="container">
                <div className="row align-items-center">
                    <div className="col-lg-6 hero-content">
                        <h1 className="hero-text text">Elevate Your Code Quality with Instant AI Reviews</h1>
                        <p className="hero-subtitle">Get intelligent, real-time feedback on your code. Catch bugs, improve performance, and follow best practices.</p>
                        <NavLink to="/register" className="btn-cta-primary">Get Started for Free</NavLink>
                    </div>
                    <div className="col-lg-6 d-flex justify-content-center">
                        <div className="robot-container">
                            <Robot />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}